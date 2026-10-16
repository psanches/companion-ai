import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationFromHtml,checkPublication,publicSourceUrl,verifyStory} from '../../health-news-verification.mjs';
test('dates: future, invalid, ten/eleven days old rejected; seven-day boundary accepted',()=>{
 for(const date of ['2026-10-17','2026-10-06','2026-10-05','2026-02-30'])assert.throws(()=>checkPublication(date,'2026-10-16'));
 assert.equal(checkPublication('2026-10-09','2026-10-16'),7);
});
test('original publication wins over update/event date; conflicting publications rejected',()=>{
 assert.equal(publicationFromHtml('<meta property="article:published_time" content="2026-10-06"><meta property="article:modified_time" content="2026-10-14">').date,'2026-10-06');
 assert.equal(publicationFromHtml('<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-10-09","dateModified":"2026-10-15"}</script>').date,'2026-10-09');
 assert.equal(publicationFromHtml('<span class="documentPublished"><span>Publicado em</span>06/10/2026 14h29</span>').date,'2026-10-06');
 assert.throws(()=>publicationFromHtml('<meta property="article:modified_time" content="2026-10-14"><time>Evento 16/10/2026</time>'));
 assert.throws(()=>publicationFromHtml('<meta name="date" content="2026-10-06"><meta property="article:published_time" content="2026-10-09">'),/conflict/);
});
test('only approved public source hosts; private and untrusted redirects refused',async()=>{
 for(const url of ['http://www.nih.gov/a','https://127.0.0.1/a','https://nih.gov.evil.example/a','https://user:pass@nih.gov/a'])assert.throws(()=>publicSourceUrl(url));
 const url='https://www.nih.gov/news/test';
 await assert.rejects(verifyStory({url,publishedAt:'2026-10-15'},'2026-10-16',new Set([url]),async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/'}})),/approved/);
 await assert.rejects(verifyStory({url,publishedAt:'2026-10-15'},'2026-10-16',new Set()),/web search/);
});
test('model date cannot replace actual source date; missing metadata is rejected',async()=>{
 const url='https://www.nih.gov/news/test',cited=new Set([url]);
 const page=html=>async()=>new Response(html,{headers:{'content-type':'text/html'}});
 await assert.rejects(verifyStory({url,publishedAt:'2026-10-14'},'2026-10-16',cited,page('<meta property="article:published_time" content="2026-10-09">')),/disagrees/);
 await assert.rejects(verifyStory({url,publishedAt:'2026-10-14'},'2026-10-16',cited,page('<h1>No publication metadata</h1>')),/could not be verified/);
});

test('English publication header and journal date formats are parsed without treating prose events as publication',()=>{
 assert.equal(publicationFromHtml('<h1>Article</h1><p class="date">October 14, 2026</p><p>Body</p>').date,'2026-10-14');
 assert.equal(publicationFromHtml('<meta name="citation_publication_date" content="2026/10/09">').date,'2026-10-09');
 assert.throws(()=>publicationFromHtml('<h1>Event</h1><p>Join us on October 14, 2026 for a class.</p>'));
});
