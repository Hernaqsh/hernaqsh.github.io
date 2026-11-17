/*
 * HerNaqsh static demo – the ONE file to edit.
 * Replace every XXXX with your real details, save, and upload this file again.
 * Nothing here is secret: everyone who opens the site can read it.
 * Do NOT put passwords, PINs or API keys here.
 */
window.HN_CONFIG = {
	// WhatsApp number in international format, digits only (e.g. 923001234567).
	// While it contains X, WhatsApp buttons show the text but do not open a chat.
	whatsappNumber: 'XXXXXXXXXXXX',
	// How the number is shown on the page.
	whatsappDisplay: '+92 XXX XXXXXXX',

	email: 'XXXX@example.com',
	hours: 'Monday–Saturday, 10am–6pm PKT (XXXX)',
	address: 'XXXX, Lahore, Pakistan',

	// Shown when the shopper chooses "Online payment".
	bank: {
		bankName: 'XXXX Bank',
		accountTitle: 'XXXX',
		accountNumber: 'XXXX XXXX XXXX',
		iban: 'PKXX XXXX XXXX XXXX XXXX XXXX'
	},
	easypaisa: { number: '03XX XXXXXXX', accountTitle: 'XXXX' },
	jazzcash: { number: '03XX XXXXXXX', accountTitle: 'XXXX' },

	// Delivery charge added at checkout (0 = free / "confirmed later").
	shippingFee: 0,
	shippingNote: 'Delivery charge is confirmed by the seller on WhatsApp.',

	currencySymbol: '₨',
	orderPrefix: 'HN-DEMO-'
};
