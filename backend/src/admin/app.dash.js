/* Owner dashboard client. Served same-origin under Cloudflare Access. Every stored value is rendered with textContent
   (never innerHTML), so inquiry content cannot inject markup or script. */
(function () {
  'use strict';
  var L = {
    en: { logout: 'Sign out', sentGmail: 'Sent from your Gmail. If the address bounces, the notice arrives in your Gmail inbox.', brand: 'Private inquiry dashboard', title: 'Inquiries', uiLang: 'Language', status: 'Status', active: 'Active (not archived)', all: 'All', type: 'Type', search: 'Search', inbox: 'Inbox', none: 'No inquiries match.', pick: 'Select an inquiry.',
      st_new: 'New', st_read: 'Read', st_pending: 'Pending', st_replied: 'Replied', st_archived: 'Archived', total: 'Total',
      t_project: 'Project inquiry', t_collab: 'Research collaboration', t_msg: 'General message',
      received: 'Received', ref: 'Reference', name: 'Name', email: 'Email', org: 'Organisation', pageLang: 'Page language', replyLang: 'Preferred reply language', budget: 'Budget', start: 'Preferred start', notify: 'Owner notification', confirm: 'Visitor confirmation', board: 'Public board',
      board_no: 'Not opted in', board_opt: 'Opted in, not shown (needs your approval)', board_on: 'Shown anonymously', brief: 'Brief as submitted',
      markRead: 'Mark read', markPending: 'Mark pending', archive: 'Archive', unarchive: 'Restore', approve: 'Show on public board', unapprove: 'Remove from public board',
      replyH: 'Reply', subject: 'Subject', body: 'Message', send: 'Send reply by email', sending: 'Sending…', notConfigured: 'Sending from the dashboard needs a verified sending domain (REPLY_FROM). Until then, reply from your own mail app and record it below.',
      openMail: 'Reply in my mail app', manual: 'Mark as replied (answered outside the dashboard)', manualNote: 'Only records that you replied elsewhere; nothing is sent.',
      del: 'Delete permanently', delAsk: 'Type the reference to delete this inquiry and its replies permanently:', deleted: 'Deleted.',
      history: 'Replies', ch_email: 'Sent through the dashboard', ch_manual: 'Recorded as answered elsewhere',
      rs_accepted: 'accepted by the email provider', rs_failed: 'failed', rs_delivered: 'delivered', rs_bounced: 'bounced', rs_delayed: 'delivery delayed', rs_complained: 'marked as spam', rs_recorded: 'recorded',
      ns_pending: 'pending', ns_accepted: 'accepted by the email provider', ns_failed: 'failed', ns_skipped: 'not sent (not configured)', ns_off: 'off', ns_delivered: 'delivered', ns_bounced: 'bounced', ns_delayed: 'delayed', ns_complained: 'marked as spam',
      saved: 'Saved.', err: 'Something went wrong. Nothing was changed.', sent: 'Accepted by the email provider. Delivery is confirmed only by a later delivery event.' },
    ko: { logout: '로그아웃', sentGmail: 'Gmail에서 발송했습니다. 주소 오류로 반송되면 Gmail 받은편지함으로 알림이 옵니다.', brand: '비공개 문의 관리', title: '문의함', uiLang: '언어', status: '상태', active: '진행 중 (보관 제외)', all: '전체', type: '유형', search: '검색', inbox: '받은 문의', none: '조건에 맞는 문의가 없습니다.', pick: '문의를 선택해 주세요.',
      st_new: '새 문의', st_read: '읽음', st_pending: '답변 대기', st_replied: '답변 완료', st_archived: '보관됨', total: '전체',
      t_project: '프로젝트 문의', t_collab: '연구 협업 제안', t_msg: '일반 메시지',
      received: '접수일', ref: '접수번호', name: '이름', email: '이메일', org: '소속', pageLang: '페이지 언어', replyLang: '희망 회신 언어', budget: '예산', start: '희망 시작 시기', notify: '관리자 알림', confirm: '방문자 확인 메일', board: '공개 문의 목록',
      board_no: '동의하지 않음', board_opt: '동의함, 아직 비공개 (승인 필요)', board_on: '익명으로 표시 중', brief: '제출된 문의 내용',
      markRead: '읽음으로 표시', markPending: '답변 대기로 표시', archive: '보관', unarchive: '보관 해제', approve: '공개 목록에 표시', unapprove: '공개 목록에서 내리기',
      replyH: '답변', subject: '제목', body: '내용', send: '이메일로 답변 보내기', sending: '보내는 중…', notConfigured: '대시보드에서 답변을 보내려면 인증된 발신 도메인(REPLY_FROM)이 필요합니다. 그전까지는 사용하시는 메일 앱으로 답변하고 아래에서 기록해 주세요.',
      openMail: '메일 앱으로 답변', manual: '답변 완료로 표시 (다른 곳에서 답변함)', manualNote: '다른 곳에서 답변했다는 사실만 기록하며, 메일은 보내지 않습니다.',
      del: '영구 삭제', delAsk: '이 문의와 답변 기록을 영구 삭제하려면 접수번호를 입력하세요:', deleted: '삭제했습니다.',
      history: '답변 기록', ch_email: '대시보드에서 발송', ch_manual: '다른 곳에서 답변한 것으로 기록',
      rs_accepted: '메일 서비스가 접수함', rs_failed: '실패', rs_delivered: '전달됨', rs_bounced: '반송됨', rs_delayed: '전달 지연', rs_complained: '스팸 신고됨', rs_recorded: '기록됨',
      ns_pending: '대기', ns_accepted: '메일 서비스가 접수함', ns_failed: '실패', ns_skipped: '미발송 (설정 안 됨)', ns_off: '사용 안 함', ns_delivered: '전달됨', ns_bounced: '반송됨', ns_delayed: '지연', ns_complained: '스팸 신고됨',
      saved: '저장했습니다.', err: '문제가 발생했습니다. 변경된 내용은 없습니다.', sent: '메일 서비스가 접수했습니다. 실제 전달 여부는 이후 전달 이벤트로 확인됩니다.' },
    bn: { logout: 'সাইন আউট', sentGmail: 'আপনার Gmail থেকে পাঠানো হয়েছে। ঠিকানা ভুল হলে ফেরত আসার নোটিশ আপনার Gmail ইনবক্সে আসবে।', brand: 'ব্যক্তিগত বার্তা ব্যবস্থাপনা', title: 'বার্তাসমূহ', uiLang: 'ভাষা', status: 'অবস্থা', active: 'চলমান (আর্কাইভ বাদে)', all: 'সব', type: 'ধরন', search: 'খুঁজুন', inbox: 'ইনবক্স', none: 'মিলে যায় এমন কোনো বার্তা নেই।', pick: 'একটি বার্তা বেছে নিন।',
      st_new: 'নতুন', st_read: 'পড়া হয়েছে', st_pending: 'উত্তরের অপেক্ষায়', st_replied: 'উত্তর দেওয়া হয়েছে', st_archived: 'আর্কাইভ করা', total: 'মোট',
      t_project: 'প্রজেক্ট নিয়ে আলোচনা', t_collab: 'গবেষণা সহযোগিতা', t_msg: 'সাধারণ বার্তা',
      received: 'গ্রহণের তারিখ', ref: 'রেফারেন্স নম্বর', name: 'নাম', email: 'ইমেইল', org: 'প্রতিষ্ঠান', pageLang: 'পাতার ভাষা', replyLang: 'উত্তরের পছন্দের ভাষা', budget: 'বাজেট', start: 'শুরুর পছন্দের সময়', notify: 'মালিকের নোটিফিকেশন', confirm: 'দর্শকের নিশ্চিতকরণ ইমেইল', board: 'প্রকাশ্য তালিকা',
      board_no: 'অনুমতি দেননি', board_opt: 'অনুমতি দিয়েছেন, এখনো দেখানো হয়নি (আপনার অনুমোদন দরকার)', board_on: 'বেনামিভাবে দেখানো হচ্ছে', brief: 'জমা দেওয়া বিবরণ',
      markRead: 'পড়া হয়েছে চিহ্নিত করুন', markPending: 'উত্তরের অপেক্ষায় চিহ্নিত করুন', archive: 'আর্কাইভ', unarchive: 'ফিরিয়ে আনুন', approve: 'প্রকাশ্য তালিকায় দেখান', unapprove: 'প্রকাশ্য তালিকা থেকে সরান',
      replyH: 'উত্তর', subject: 'বিষয়', body: 'বার্তা', send: 'ইমেইলে উত্তর পাঠান', sending: 'পাঠানো হচ্ছে…', notConfigured: 'ড্যাশবোর্ড থেকে উত্তর পাঠাতে যাচাইকৃত সেন্ডিং ডোমেইন (REPLY_FROM) দরকার। ততদিন নিজের মেইল অ্যাপ থেকে উত্তর দিয়ে নিচে তা রেকর্ড করুন।',
      openMail: 'মেইল অ্যাপে উত্তর দিন', manual: 'উত্তর দেওয়া হয়েছে চিহ্নিত করুন (অন্য কোথাও উত্তর দিয়েছেন)', manualNote: 'শুধু রেকর্ড রাখে যে অন্য কোথাও উত্তর দিয়েছেন; কিছু পাঠানো হয় না।',
      del: 'স্থায়ীভাবে মুছুন', delAsk: 'এই বার্তা ও এর উত্তর স্থায়ীভাবে মুছতে রেফারেন্স নম্বর লিখুন:', deleted: 'মুছে ফেলা হয়েছে।',
      history: 'উত্তরসমূহ', ch_email: 'ড্যাশবোর্ড থেকে পাঠানো', ch_manual: 'অন্য কোথাও উত্তর দেওয়া হয়েছে বলে রেকর্ড',
      rs_accepted: 'ইমেইল সেবা গ্রহণ করেছে', rs_failed: 'ব্যর্থ', rs_delivered: 'পৌঁছেছে', rs_bounced: 'ফেরত এসেছে', rs_delayed: 'পৌঁছাতে দেরি', rs_complained: 'স্প্যাম হিসেবে চিহ্নিত', rs_recorded: 'রেকর্ড করা',
      ns_pending: 'অপেক্ষমাণ', ns_accepted: 'ইমেইল সেবা গ্রহণ করেছে', ns_failed: 'ব্যর্থ', ns_skipped: 'পাঠানো হয়নি (সেটআপ নেই)', ns_off: 'বন্ধ', ns_delivered: 'পৌঁছেছে', ns_bounced: 'ফেরত এসেছে', ns_delayed: 'দেরি', ns_complained: 'স্প্যাম হিসেবে চিহ্নিত',
      saved: 'সংরক্ষিত।', err: 'একটি সমস্যা হয়েছে। কিছুই পরিবর্তন হয়নি।', sent: 'ইমেইল সেবা গ্রহণ করেছে। পৌঁছানো নিশ্চিত হবে পরবর্তী ডেলিভারি ইভেন্টে।' }
  };
  var BUD = { 'bud.discuss': 'Not sure / discuss', 'bud.krw.1': 'Under ₩5M', 'bud.krw.2': '₩5M – ₩20M', 'bud.krw.3': '₩20M – ₩50M', 'bud.krw.4': 'Over ₩50M',
    'bud.usd.1': 'Under $5k', 'bud.usd.2': '$5k – $15k', 'bud.usd.3': '$15k – $40k', 'bud.usd.4': 'Over $40k' };
  var START = { 'opt.notsure': 'Not sure', 'start.asap': 'As soon as possible', 'start.m1': 'Within a month', 'start.m3': 'Within three months', 'start.later': 'Later' };
  var lang = 'en';
  try { lang = localStorage.getItem('ag-admin-lang') || (navigator.language || '').slice(0, 2); } catch (e) {}
  if (!L[lang]) lang = 'en';
  function t(k) { return (L[lang] && L[lang][k]) || L.en[k] || k; }
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function api(method, path, body) {
    var o = { method: method, headers: { 'x-ag-admin': '1' }, credentials: 'same-origin' };
    if (body !== undefined) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(path, o).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function msg(s) { $('#msg').textContent = s || ''; }
  function date(ms) { try { return new Date(ms).toLocaleString(lang === 'ko' ? 'ko-KR' : lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return new Date(ms).toISOString(); } }
  var state = { items: [], sel: null, me: null };

  function applyStatic() {
    document.documentElement.lang = lang;
    Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (n) { n.textContent = t(n.getAttribute('data-t')); });
    $('#ui-lang').value = lang;
  }
  function stats(c) {
    var s = $('#stats'); s.textContent = '';
    [['total', c.total], ['st_new', c.new], ['st_read', c.read], ['st_pending', c.pending], ['st_replied', c.replied], ['st_archived', c.archived]].forEach(function (x) {
      s.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(x[1] || 0) }), el('span', { text: t(x[0]) })]));
    });
  }
  function load() {
    var q = new URLSearchParams();
    if ($('#f-status').value) q.set('status', $('#f-status').value);
    if ($('#f-intent').value) q.set('intent', $('#f-intent').value);
    if ($('#f-q').value.trim()) q.set('q', $('#f-q').value.trim());
    return api('GET', '/api/inquiries?' + q.toString()).then(function (r) {
      if (!r.ok) { msg(t('err')); return; }
      state.items = r.d.items; stats(r.d.counts || {}); renderList();
    });
  }
  function renderList() {
    var ul = $('#list'); ul.textContent = '';
    $('#empty').hidden = state.items.length > 0;
    state.items.forEach(function (x) {
      var b = el('button', { type: 'button', 'aria-current': String(state.sel === x.id), onclick: function () { open(x.id); } }, [
        el('span', { class: 'r1' }, [el('span', { text: x.ref + ' · ' + t('t_' + x.intent) }), el('span', { class: 'badge' + (x.status === 'new' ? ' new' : ''), text: t('st_' + x.status) })]),
        el('span', { class: 'r2', text: x.name + (x.org ? ' · ' + x.org : '') }),
        el('span', { class: 'r1' }, [el('span', { text: date(x.created_at) }), el('span', { text: x.budget ? (BUD[x.budget] || x.budget) : '' })])
      ]);
      ul.appendChild(el('li', {}, [b]));
    });
  }
  function row(dl, k, v) { if (v === null || v === undefined || v === '') return; dl.appendChild(el('dt', { text: t(k) })); dl.appendChild(el('dd', { text: String(v) })); }
  function act(label, cls, fn) { return el('button', { type: 'button', class: cls || 'line', onclick: fn, text: t(label) }); }
  function setStatus(id, s) { api('POST', '/api/inquiries/' + id + '/status', { status: s }).then(function (r) { msg(r.ok ? t('saved') : t('err')); load(); open(id); }); }

  function open(id) {
    state.sel = id; renderList();
    api('GET', '/api/inquiries/' + id).then(function (r) {
      var d = $('#detail'); d.textContent = '';
      if (!r.ok) { d.appendChild(el('p', { class: 'muted', text: t('err') })); return; }
      var q = r.d.inquiry, f = q.fields || {};
      d.appendChild(el('p', { class: 'k', text: t('t_' + q.intent) + ' · ' + t('st_' + q.status) }));
      d.appendChild(el('h2', { text: q.name }));
      var dl = el('dl');
      row(dl, 'ref', q.ref); row(dl, 'received', date(q.created_at)); row(dl, 'email', q.email); row(dl, 'org', q.org);
      row(dl, 'pageLang', q.lang); row(dl, 'replyLang', q.reply_lang);
      if (f.budget) row(dl, 'budget', BUD[f.budget] || f.budget);
      if (f.start) row(dl, 'start', START[f.start] || f.start);
      row(dl, 'notify', t('ns_' + q.notify_status)); row(dl, 'confirm', t('ns_' + q.confirm_status));
      row(dl, 'board', q.board_optin ? (q.board_approved ? t('board_on') : t('board_opt')) : t('board_no'));
      d.appendChild(dl);
      d.appendChild(el('p', { class: 'k', text: t('brief') }));
      d.appendChild(el('div', { class: 'brief', text: q.brief }));
      var a = el('div', { class: 'actions' });
      if (q.status === 'new') a.appendChild(act('markRead', '', function () { setStatus(id, 'read'); }));
      if (q.status !== 'pending' && q.status !== 'replied') a.appendChild(act('markPending', 'line', function () { setStatus(id, 'pending'); }));
      a.appendChild(q.status === 'archived' ? act('unarchive', 'line', function () { setStatus(id, 'read'); }) : act('archive', 'line', function () { setStatus(id, 'archived'); }));
      if (q.board_optin) a.appendChild(act(q.board_approved ? 'unapprove' : 'approve', 'line', function () { api('POST', '/api/inquiries/' + id + '/board', { approved: !q.board_approved }).then(function (x) { msg(x.ok ? t('saved') : t('err')); open(id); }); }));
      a.appendChild(act('del', 'warn', function () {
        var ref = window.prompt(t('delAsk'));
        if (ref === null) return;
        api('DELETE', '/api/inquiries/' + id, { confirm: ref.trim() }).then(function (x) { msg(x.ok ? t('deleted') : t('err')); if (x.ok) { state.sel = null; $('#detail').textContent = ''; load(); } });
      }));
      d.appendChild(a);
      // reply
      var subj = el('input', { type: 'text', maxlength: '200', id: 'r-subj' }); subj.value = 'Re: [' + q.ref + '] ' + t('t_' + q.intent);
      var body = el('textarea', { id: 'r-body', maxlength: '20000' });
      var send = el('button', { type: 'button', text: t('send') });
      send.disabled = !(state.me && state.me.replyConfigured);
      send.addEventListener('click', function () {
        send.disabled = true; send.textContent = t('sending');
        api('POST', '/api/inquiries/' + id + '/reply', { subject: subj.value, body: body.value }).then(function (x) {
          msg(x.ok ? t(state.me && state.me.provider === 'gmail' ? 'sentGmail' : 'sent') : t('err')); send.textContent = t('send'); send.disabled = false; load(); open(id);
        });
      });
      var mail = el('a', { class: 'note', href: 'mailto:' + encodeURIComponent(q.email).replace('%40', '@') + '?subject=' + encodeURIComponent(subj.value), text: t('openMail') });
      var manual = act('manual', 'line', function () { api('POST', '/api/inquiries/' + id + '/manual-reply', { subject: subj.value, body: body.value }).then(function (x) { msg(x.ok ? t('saved') : t('err')); load(); open(id); }); });
      d.appendChild(el('h3', { text: t('replyH') }));
      if (!(state.me && state.me.replyConfigured)) d.appendChild(el('p', { class: 'warnline', text: t('notConfigured') }));
      d.appendChild(el('label', { for: 'r-subj', class: 'note', text: t('subject') })); d.appendChild(subj);
      d.appendChild(el('label', { for: 'r-body', class: 'note', text: t('body') })); d.appendChild(body);
      d.appendChild(el('div', { class: 'actions' }, [send, mail, manual]));
      d.appendChild(el('p', { class: 'note', text: t('manualNote') }));
      if (r.d.replies.length) {
        var h = el('div', { class: 'replies' }, [el('h3', { text: t('history') })]);
        r.d.replies.forEach(function (x) {
          h.appendChild(el('div', { class: 'reply' }, [
            el('p', { class: 'note', text: date(x.created_at) + ' · ' + t('ch_' + x.channel) + ' · ' + t('rs_' + x.status) + (x.error ? ' (' + x.error + ')' : '') }),
            el('strong', { text: x.subject }), el('div', { text: x.body })
          ]));
        });
        d.appendChild(h);
      }
    });
  }

  $('#ui-lang').addEventListener('change', function (e) { lang = e.target.value; try { localStorage.setItem('ag-admin-lang', lang); } catch (x) {} applyStatic(); load(); if (state.sel) open(state.sel); });
  ['#f-status', '#f-intent'].forEach(function (s) { $(s).addEventListener('change', load); });
  var deb; $('#f-q').addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(load, 250); });
  applyStatic();
  $('#logout').addEventListener('click', function () { api('POST', '/auth/logout', {}).then(function () { location.href = '/'; }, function () { location.href = '/'; }); });
  api('GET', '/api/me').then(function (r) { if (r.ok) { state.me = r.d; $('#who').textContent = r.d.email; if (r.d.auth === 'google') $('#logout').hidden = false; } load(); });
})();
