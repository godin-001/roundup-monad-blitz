// Cuando el usuario hace click en el ícono de la extensión,
// abre popup.html como una pestaña normal (donde MetaMask SÍ inyecta)
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});
