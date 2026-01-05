/*
 * This code is for Internal Salesforce use only, and subject to change without notice.
 * Customers shouldn't reference this file in any web pages.
 */
(function(){if(window.self===window.top)console.debug("[vf3pc] not iframed");else{var e=(new URL(document.referrer)).hostname,d=(new URL(window.origin)).hostname,b=-2;d.endsWith(".crm.dev")&&(b=-5);var c=e.split(".").slice(b).join("."),g=d.split(".").slice(b).join("."),h=c!==g,b=location.pathname;console.debug("[vf3pc] iframeIsThirdPartyContext \x3d "+h+"\niframePathName \x3d "+b+"\nreferrerHostname \x3d "+e+"\nreferrerRootDomain \x3d "+c+"\niframeHostname \x3d "+d+"\niframeRootDomain \x3d "+g);if(h){var f=
e+"|"+d+"|"+b,k=function(){var a;try{return a=window.sessionStorage,a.setItem("__storage_test__","__storage_test__"),a.removeItem("__storage_test__"),!0}catch(b){return b instanceof DOMException&&"QuotaExceededError"===b.name&&a&&0!==a.length}}();if(k){if(sessionStorage.getItem(f)){console.debug("[vf3pc] Already logged, skipping. sessionStorageKey: "+f);return}}else console.debug("[vf3pc] Session storage is not available");c=new FormData;c.append("referrerHostname",e);c.append("iframeHostname",d);
c.append("iframePathName",b);fetch("/vf/ThirdPartyContext",{method:"POST",body:c}).then(function(a){a.ok?(console.debug("[vf3pc] Response status: "+a.status),k&&sessionStorage.setItem(f,"true")):console.error("[vf3pc] Response status: "+a.status)}).catch(function(a){console.error("[vf3pc] "+a.message)})}}})();

//# sourceMappingURL=/javascript/1746125338113/sfdc/source/IframeThirdPartyContextLogging.js.map
