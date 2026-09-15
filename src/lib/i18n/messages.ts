/**
 * Every string a tenant reads, in both languages.
 *
 * Flat dotted keys rather than nested objects, because the guarantee that
 * matters is that Bangla cannot fall behind English — and a flat record types
 * that in one line: `bn` is declared `Record<MessageKey, string>`, so a key
 * added to `en` and forgotten in `bn` fails `npm run typecheck` rather than
 * reaching a shop owner as a blank space or an English sentence.
 *
 * No library. `next-intl` and its peers bring routing, negotiation and message
 * compilation; this application needs a lookup table and one substitution rule.
 *
 * Pure, so the strings can be asserted in a unit test.
 */

const en = {
  /* -------------------------------------------------------------- shared */
  "common.next": "Next",
  "common.back": "Back",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.show": "Show",
  "common.hide": "Hide",
  "common.saving": "Saving…",
  "common.skipForNow": "Skip for now",
  "common.stuck": "I am stuck — message us",

  /* -------------------------------------------------------------- wizard */
  "wizard.title": "Connect your WhatsApp number",
  "wizard.progress": "Step {current} of {total}",

  "wizard.step1.title": "Try it before you connect",
  "wizard.step1.body":
    "Type a question the way a customer would. The answer comes from your own products, so you can see how it will work before you set anything up.",
  "wizard.step1.placeholder": "Ask about a product…",
  "wizard.step1.connect": "Looks good — connect my number",
  "wizard.step1.sandbox": "Use our test number for now",
  "wizard.step1.sandboxNote":
    "You can start on our number and connect your own later. Your customers will see our number until you do.",

  "wizard.step2.title": "Create your Meta app",
  "wizard.step2.intro":
    "WhatsApp is run by Meta. You need a free Meta app to let us send and receive messages for you. This takes about five minutes.",
  "wizard.step2.item1":
    "Open developers.facebook.com and log in with Facebook.",
  "wizard.step2.item2": "Click My Apps, then Create App.",
  "wizard.step2.item3":
    "For the use case, choose “Connect with customers through WhatsApp”.",
  "wizard.step2.item4": "Choose your business, or create one.",
  "wizard.step2.item5": "Click Create app.",
  "wizard.step2.warning":
    "If Facebook says your account is restricted from advertising, this will not work. Use a colleague's account, or message us and we will do it with you.",
  "wizard.step2.done": "Done — next",

  /* -------------------------------------------------------------- step 3 */
  "wizard.step3.title": "Copy your three values",
  "wizard.step3.intro":
    "In the app you just made, open WhatsApp, then API Setup. Claim the free test number, or add your own number.",
  "wizard.step3.item1": "Copy the Phone number ID.",
  "wizard.step3.item2": "Copy the WhatsApp Business Account ID.",
  "wizard.step3.item3": "Click Generate token, then copy the token.",
  "wizard.step3.phoneNumberId": "Phone number ID",
  "wizard.step3.wabaId": "WhatsApp Business Account ID",
  "wizard.step3.accessToken": "Token",
  "wizard.step3.appSecret": "App secret (only if you made your own app)",
  "wizard.step3.appSecretHelp":
    "Find it in your app under App settings, then Basic, then Show.",
  "wizard.step3.encrypted":
    "We encrypt this. It is never stored as plain text.",
  "wizard.step3.save": "Save and continue",

  /* -------------------------------------------------------------- step 4 */
  "wizard.step4.title": "Tell Meta where to send messages",
  "wizard.step4.callbackUrl": "Callback URL",
  "wizard.step4.verifyToken": "Verify token",
  "wizard.step4.item1": "In your Meta app, open WhatsApp, then Configuration.",
  "wizard.step4.item2": "Next to Webhook, click Edit.",
  "wizard.step4.item3": "Paste the two values above into the two boxes.",
  "wizard.step4.item4": "Click Verify and save.",
  "wizard.step4.item5":
    "Under Webhook fields, find messages and click Subscribe.",
  "wizard.step4.mustSubscribe":
    "Do not skip the last step. If you miss it, no customer message will reach us.",
  "wizard.step4.waiting": "Waiting for your first message from Meta…",
  "wizard.step4.arrived": "It works. Meta reached us.",
  "wizard.step4.temporaryUrl":
    "This address is temporary. If your tunnel restarts, you will have to paste the new address into Meta again.",

  /* -------------------------------------------------------------- step 5 */
  "wizard.step5.title": "Send yourself a test",
  "wizard.step5.intro":
    "Put in your own WhatsApp number. We will send you one message.",
  "wizard.step5.number": "Your WhatsApp number",
  "wizard.step5.numberHelp":
    "With the country code, for example 8801712345678.",
  "wizard.step5.send": "Send the test",
  "wizard.step5.success": "Sent. Check your phone.",
  "wizard.step5.backToStep3": "Go back and paste the token again",

  /* -------------------------------------------------------------- errors */
  "error.token.expired":
    "This token has expired. Generate a new one and paste it again.",
  "error.phoneNumberId.invalid":
    "That Phone number ID does not look right. Copy it again from the API Setup page.",
  "error.token.permissions": "This token does not have WhatsApp permissions.",
  "error.generic":
    "Something went wrong at Meta's end. Try again, and message us if it keeps failing.",
  "error.planLimit":
    "Your plan allows {limit} WhatsApp number(s), and you are already using them all. Upgrade your plan to connect another.",
  "error.notAllowed": "You do not have permission to change this.",

  /* -------------------------------------------------------------- health */
  "health.title": "Your WhatsApp connection",
  "health.number": "Number",
  "health.verifiedName": "Name customers see",
  "health.quality": "Quality",
  "health.quality.green": "Healthy. Customers are happy with your messages.",
  "health.quality.yellow": "Some customers are blocking or reporting you.",
  "health.quality.red": "Your number is at risk of being restricted by Meta.",
  "health.quality.unknown": "Meta has not rated your number yet.",
  "health.limit": "How many people you can message",
  "health.lastMessage": "Last message",
  "health.silent": "Nothing has arrived for more than a day.",
  "health.tokenExpiring":
    "Your token stops working in {days} day(s). Generate a new one and paste it in.",
  "health.updateToken": "Update token",
  "health.sendTest": "Send a test message",
  "health.disconnect": "Disconnect",
  "health.disconnectConfirm":
    "Your customers' messages will stop reaching you. Your past conversations are kept.",
  "health.templates": "Message templates",
  "health.syncTemplates": "Get the latest from Meta",
} as const;

export type MessageKey = keyof typeof en;

/**
 * Typed against `en`, so a missing or misspelled key is a build failure.
 */
const bn: Readonly<Record<MessageKey, string>> = {
  "common.next": "পরের ধাপ",
  "common.back": "আগের ধাপ",
  "common.copy": "কপি",
  "common.copied": "কপি হয়েছে",
  "common.show": "দেখান",
  "common.hide": "লুকান",
  "common.saving": "সেভ হচ্ছে…",
  "common.skipForNow": "এখন থাক",
  "common.stuck": "আটকে গেছি — আমাদের মেসেজ দিন",

  "wizard.title": "আপনার হোয়াটসঅ্যাপ নম্বর যুক্ত করুন",
  "wizard.progress": "ধাপ {current} / {total}",

  "wizard.step1.title": "যুক্ত করার আগে দেখে নিন",
  "wizard.step1.body":
    "ক্রেতা যেভাবে প্রশ্ন করে, সেভাবে লিখুন। উত্তর আসবে আপনার নিজের পণ্য থেকে, তাই কিছু সেট করার আগেই দেখে নিতে পারবেন।",
  "wizard.step1.placeholder": "কোনো পণ্যের কথা জিজ্ঞাসা করুন…",
  "wizard.step1.connect": "ভালো লেগেছে — আমার নম্বর যুক্ত করুন",
  "wizard.step1.sandbox": "আপাতত আমাদের টেস্ট নম্বর ব্যবহার করি",
  "wizard.step1.sandboxNote":
    "আপনি আমাদের নম্বর দিয়ে শুরু করে পরে নিজের নম্বর যুক্ত করতে পারবেন। ততক্ষণ ক্রেতারা আমাদের নম্বরই দেখবে।",

  "wizard.step2.title": "আপনার Meta অ্যাপ তৈরি করুন",
  "wizard.step2.intro":
    "হোয়াটসঅ্যাপ চালায় Meta। আপনার হয়ে মেসেজ পাঠাতে ও নিতে আমাদের একটি ফ্রি Meta অ্যাপ লাগবে। সময় লাগবে প্রায় পাঁচ মিনিট।",
  "wizard.step2.item1":
    "developers.facebook.com খুলুন, ফেসবুক দিয়ে লগইন করুন।",
  "wizard.step2.item2": "My Apps-এ ক্লিক করুন, তারপর Create App।",
  "wizard.step2.item3":
    "use case হিসেবে বেছে নিন “Connect with customers through WhatsApp”।",
  "wizard.step2.item4": "আপনার ব্যবসা বেছে নিন, না থাকলে নতুন তৈরি করুন।",
  "wizard.step2.item5": "Create app-এ ক্লিক করুন।",
  "wizard.step2.warning":
    "ফেসবুক যদি বলে আপনার অ্যাকাউন্টে বিজ্ঞাপনে নিষেধাজ্ঞা আছে, তাহলে এটি কাজ করবে না। সহকর্মীর অ্যাকাউন্ট ব্যবহার করুন, অথবা আমাদের মেসেজ দিন — আমরা একসাথে করে দেব।",
  "wizard.step2.done": "হয়ে গেছে — পরের ধাপ",

  "wizard.step3.title": "তিনটি তথ্য কপি করুন",
  "wizard.step3.intro":
    "এইমাত্র বানানো অ্যাপে WhatsApp খুলুন, তারপর API Setup। ফ্রি টেস্ট নম্বরটি নিন, অথবা নিজের নম্বর যোগ করুন।",
  "wizard.step3.item1": "Phone number ID কপি করুন।",
  "wizard.step3.item2": "WhatsApp Business Account ID কপি করুন।",
  "wizard.step3.item3": "Generate token-এ ক্লিক করে টোকেনটি কপি করুন।",
  "wizard.step3.phoneNumberId": "Phone number ID",
  "wizard.step3.wabaId": "WhatsApp Business Account ID",
  "wizard.step3.accessToken": "টোকেন",
  "wizard.step3.appSecret": "App secret (শুধু নিজের অ্যাপ বানালে)",
  "wizard.step3.appSecretHelp": "অ্যাপের App settings → Basic → Show-এ পাবেন।",
  "wizard.step3.encrypted":
    "আমরা এটি এনক্রিপ্ট করে রাখি। সাধারণ লেখা হিসেবে কখনো রাখা হয় না।",
  "wizard.step3.save": "সেভ করে এগিয়ে যান",

  "wizard.step4.title": "Meta-কে বলুন মেসেজ কোথায় পাঠাতে হবে",
  "wizard.step4.callbackUrl": "Callback URL",
  "wizard.step4.verifyToken": "Verify token",
  "wizard.step4.item1":
    "আপনার Meta অ্যাপে WhatsApp খুলুন, তারপর Configuration।",
  "wizard.step4.item2": "Webhook-এর পাশে Edit-এ ক্লিক করুন।",
  "wizard.step4.item3": "উপরের দুটি মান দুটি ঘরে পেস্ট করুন।",
  "wizard.step4.item4": "Verify and save-এ ক্লিক করুন।",
  "wizard.step4.item5":
    "Webhook fields-এর নিচে messages খুঁজে Subscribe-এ ক্লিক করুন।",
  "wizard.step4.mustSubscribe":
    "শেষ ধাপটি বাদ দেবেন না। বাদ পড়লে ক্রেতার কোনো মেসেজ আমাদের কাছে আসবে না।",
  "wizard.step4.waiting": "Meta থেকে প্রথম মেসেজের অপেক্ষায়…",
  "wizard.step4.arrived": "কাজ করছে। Meta আমাদের কাছে পৌঁছেছে।",
  "wizard.step4.temporaryUrl":
    "এই ঠিকানাটি সাময়িক। টানেল আবার চালু হলে নতুন ঠিকানা Meta-তে আবার বসাতে হবে।",

  "wizard.step5.title": "নিজেকে একটি টেস্ট পাঠান",
  "wizard.step5.intro":
    "আপনার নিজের হোয়াটসঅ্যাপ নম্বর দিন। আমরা একটি মেসেজ পাঠাব।",
  "wizard.step5.number": "আপনার হোয়াটসঅ্যাপ নম্বর",
  "wizard.step5.numberHelp": "দেশের কোডসহ, যেমন 8801712345678।",
  "wizard.step5.send": "টেস্ট পাঠান",
  "wizard.step5.success": "পাঠানো হয়েছে। ফোন দেখুন।",
  "wizard.step5.backToStep3": "ফিরে গিয়ে টোকেনটি আবার বসান",

  "error.token.expired": "এই টোকেনের মেয়াদ শেষ। নতুন একটি তৈরি করে আবার বসান।",
  "error.phoneNumberId.invalid":
    "Phone number ID-টি ঠিক মনে হচ্ছে না। API Setup পাতা থেকে আবার কপি করুন।",
  "error.token.permissions": "এই টোকেনে হোয়াটসঅ্যাপের অনুমতি নেই।",
  "error.generic":
    "Meta-র দিকে কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন, বারবার হলে আমাদের মেসেজ দিন।",
  "error.planLimit":
    "আপনার প্ল্যানে {limit}টি হোয়াটসঅ্যাপ নম্বর রাখা যায়, এবং সবগুলোই ব্যবহার হয়ে গেছে। আরেকটি যুক্ত করতে প্ল্যান বাড়ান।",
  "error.notAllowed": "এটি বদলানোর অনুমতি আপনার নেই।",

  "health.title": "আপনার হোয়াটসঅ্যাপ সংযোগ",
  "health.number": "নম্বর",
  "health.verifiedName": "ক্রেতারা যে নাম দেখে",
  "health.quality": "মান",
  "health.quality.green": "ভালো আছে। ক্রেতারা আপনার মেসেজে সন্তুষ্ট।",
  "health.quality.yellow": "কিছু ক্রেতা আপনাকে ব্লক বা রিপোর্ট করছে।",
  "health.quality.red": "Meta আপনার নম্বরে সীমা বসিয়ে দিতে পারে।",
  "health.quality.unknown": "Meta এখনো আপনার নম্বরের মান ঠিক করেনি।",
  "health.limit": "দিনে কতজনকে মেসেজ দিতে পারবেন",
  "health.lastMessage": "শেষ মেসেজ",
  "health.silent": "এক দিনের বেশি সময় ধরে কিছু আসেনি।",
  "health.tokenExpiring":
    "আপনার টোকেন {days} দিনে কাজ করা বন্ধ করবে। নতুন একটি তৈরি করে বসান।",
  "health.updateToken": "টোকেন বদলান",
  "health.sendTest": "একটি টেস্ট মেসেজ পাঠান",
  "health.disconnect": "সংযোগ বিচ্ছিন্ন করুন",
  "health.disconnectConfirm":
    "ক্রেতাদের মেসেজ আর আপনার কাছে আসবে না। আগের কথোপকথন থেকে যাবে।",
  "health.templates": "মেসেজ টেমপ্লেট",
  "health.syncTemplates": "Meta থেকে নতুন তালিকা আনুন",
};

export const MESSAGES = { en, bn } as const;
