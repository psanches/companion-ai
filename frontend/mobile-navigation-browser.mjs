// UI navigation only; no credentials, personal data, API requests or outgoing actions.
export async function openMobileSection(page,section=null){
 if(!await page.locator('html').evaluate(n=>n.classList.contains('lumi-mobile-light')))return;
 if(!await page.locator('#conversationSidebar').evaluate(n=>n.classList.contains('open')))await page.locator('#chatHistoryBtn').click();
 if(section&&!await page.locator('#'+section).evaluate(n=>n.open))await page.locator('#'+section+' > summary').click();
}
export async function closeMobileMenu(page){
 if(await page.locator('html').evaluate(n=>n.classList.contains('lumi-mobile-light'))&&await page.locator('#conversationSidebar').evaluate(n=>n.classList.contains('open')))await page.locator('#closeSidebarBtn').click();
}
