import assert from 'node:assert/strict';

// Runs against the real packaged app with synthetic identity and phone only.
// Outbound destinations are inspected, never clicked: no SOS is sent or dialed.
export async function checkEmergencyContact(page,{mobile=false,screenshotPath}={}){
 if(mobile)await page.locator('#chatHistoryBtn').click();
 await page.locator('#lumiSosBtn').click();
 const dialog=page.locator('#lumiSosDialog');await dialog.waitFor({state:'visible'});
 assert.equal(await page.locator('#lumiSosSamuCall').getAttribute('href'),'tel:192');
 assert.equal(await page.locator('#lumiSosSamuCall').isVisible(),true,'SAMU is available before caregiver registration');
 assert.equal(await page.locator('#lumiSosActions').isVisible(),false);
 await page.locator('#lumiSosName').fill('Cuidador fictício');
 await page.locator('#lumiSosPhone').fill('99999-0000');
 await dialog.getByRole('button',{name:'Salvar contato',exact:true}).click();
 await page.locator('#lumiSosStatus').getByText(/Confira o telefone/).waitFor();
 assert.equal(await page.locator('#lumiSosActions').isVisible(),false);
 await page.locator('#lumiSosPhone').fill('(11) 99999-0000');
 await dialog.getByRole('button',{name:'Salvar contato',exact:true}).click();
 await page.locator('#lumiSosWhatsApp').waitFor({state:'visible'});
 assert.equal(await page.locator('#lumiSosForm').isVisible(),false);
 assert.equal(await page.locator('#lumiSosCall').getAttribute('href'),'tel:+5511999990000');
 const whatsapp=new URL(await page.locator('#lumiSosWhatsApp').getAttribute('href'));
 assert.equal(whatsapp.pathname,'/5511999990000');assert.equal(whatsapp.searchParams.get('text'),'Preciso de ajuda. Por favor, entre em contato comigo.');
 assert.equal(await page.locator('#lumiSosWhatsApp').getAttribute('rel'),'noopener noreferrer');
 assert.equal(await page.locator('#lumiSosActions').getByText(/não confirma envio, leitura ou atendimento/).count(),1);
 const rect=await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return {right:r.right,left:r.left,width:innerWidth,overflow:d.scrollWidth>d.clientWidth+1};});
 assert.ok(rect.left>=0&&rect.right<=rect.width+1&&!rect.overflow,JSON.stringify(rect));
 if(screenshotPath)await page.screenshot({path:screenshotPath,fullPage:true});
 await dialog.getByRole('button',{name:'Editar contato',exact:true}).click();
 assert.equal(await page.locator('#lumiSosSamuCall').isVisible(),true);
 await page.locator('#lumiSosName').fill('Edição cancelada');
 await dialog.getByRole('button',{name:'Cancelar edição',exact:true}).click();
 assert.equal(await page.locator('#lumiSosActions h3').textContent(),'Cuidador fictício');
 await dialog.getByRole('button',{name:'Voltar à Lumi',exact:true}).click();
 if(mobile)await page.locator('#chatHistoryBtn').click();
 await page.locator('#lumiSosBtn').click();
 await page.locator('#lumiSosActions').waitFor({state:'visible'});
 assert.equal(await page.locator('#lumiSosActions h3').textContent(),'Cuidador fictício');
 await page.keyboard.press('Escape');await page.locator('#lumiSosDialog').waitFor({state:'detached'});
}
