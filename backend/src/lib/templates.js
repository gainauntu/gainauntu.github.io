// Email texts. Visitor confirmations are fixed templates in the visitor's language: they repeat only the reference and the
// inquiry type, never the visitor's own free text, so the form cannot be used to send arbitrary content to third parties.
const T = {
  intent: {
    project: ['Project inquiry', '프로젝트 문의', 'প্রজেক্ট নিয়ে আলোচনা'],
    collab: ['Research collaboration', '연구 협업 제안', 'গবেষণা সহযোগিতা'],
    msg: ['General message', '일반 메시지', 'সাধারণ বার্তা']
  },
  confirmSubject: ['Your inquiry {ref} was received', '문의가 접수되었습니다 ({ref})', 'আপনার বার্তা গ্রহণ করা হয়েছে ({ref})'],
  confirmBody: [
    'Hello,\n\nThank you for contacting me through gainauntu.github.io. Your inquiry ({type}) has been received.\n\nReference: {ref}\n\nI will review it and reply by email. Receiving an inquiry does not establish a quotation or contract.\n\nIf you did not send this, you can ignore this email.\n\nAuntu Gain',
    '안녕하세요.\n\ngainauntu.github.io를 통해 보내 주신 문의({type})가 접수되었습니다.\n\n접수번호: {ref}\n\n내용을 검토한 뒤 이메일로 회신드리겠습니다. 문의 접수만으로 견적이나 계약이 확정되는 것은 아닙니다.\n\n본인이 보낸 문의가 아니라면 이 메일은 무시하셔도 됩니다.\n\n가인온투 (Auntu Gain)',
    'gainauntu.github.io-এর মাধ্যমে যোগাযোগ করার জন্য ধন্যবাদ। আপনার বার্তাটি ({type}) গ্রহণ করা হয়েছে।\n\nরেফারেন্স নম্বর: {ref}\n\nবার্তাটি পর্যালোচনা করে ইমেইলে উত্তর দেব। বার্তা পাঠালেই কোনো মূল্যপ্রস্তাব বা চুক্তি চূড়ান্ত হয় না।\n\nআপনি এই বার্তা না পাঠিয়ে থাকলে ইমেইলটি উপেক্ষা করুন।\n\nঅন্তু গাইন (Auntu Gain)'
  ]
};
const IDX = { en: 0, ko: 1, bn: 2 };
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

export function confirmation(lang, intent, ref) {
  const i = IDX[lang] ?? 0;
  return { subject: fill(T.confirmSubject[i], { ref }), text: fill(T.confirmBody[i], { ref, type: T.intent[intent][i] }) };
}

// to the owner: everything needed to answer, in English (the dashboard holds the same data)
export function ownerNotification(row, fields) {
  const type = T.intent[row.intent][0];
  const lines = [
    `New ${type.toLowerCase()} on gainauntu.github.io`,
    '',
    `Reference: ${row.ref}`,
    `Name: ${row.name}`,
    `Email: ${row.email}`,
    row.org ? `Organisation: ${row.org}` : null,
    `Page language: ${row.lang} · preferred reply language: ${row.reply_lang}`,
    `Public board: ${row.board_optin ? 'visitor opted in (needs your approval)' : 'no'}`,
    '',
    '--- Brief as reviewed by the visitor ---',
    row.brief,
    '',
    'Open the dashboard to reply or change the status. If you reply from your own mail app instead, mark it as replied in the dashboard.'
  ].filter((l) => l !== null);
  return { subject: `[${row.ref}] ${type}: ${row.name}`, text: lines.join('\n') };
}

export const INTENT_LABEL = T.intent;
