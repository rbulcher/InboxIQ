importScripts("ExtPay.js");

// To test payments, replace 'sample-extension' with the ID of
// the extension you registered on ExtensionPay.com. You may
// need to uninstall and reinstall the extension.
// And don't forget to change the ID in popup.js too!
var extpay = ExtPay("inboxiq-pro");
extpay.startBackground(); // this line is required to use ExtPay in the rest of your extension
