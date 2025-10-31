// FSC Document Hub - CORS Bypass Extension
// This extension enables URL uploads from Cin7 by adding CORS headers

chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ FSC Document Hub CORS Bypass Extension installed');
  console.log('🔓 CORS bypass enabled for go.cin7.com');
  console.log('📝 Extension will add CORS headers to Cin7 PDF requests');
});
