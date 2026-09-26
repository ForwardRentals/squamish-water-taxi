/* ==========================================================================
   Squamish Water Taxi - AI chat assistant
   Floating "Ask us anything" chat. Answers come from the swt-chat Cloudflare
   Worker (repo ForwardRentals/swt-chat), which also files leads into the
   CRM (crm-platform-api, Squamish Water Taxi workspace). The browser only
   ever talks to the Worker - the CRM ingest key never reaches this file.

   Any element with a data-open-chat attribute opens the panel.
   ========================================================================== */

(function () {
  "use strict";

  var CHAT_ENDPOINT = "https://swt-chat.thefulltimehobby.workers.dev";
  var PHONE = "(604) 849-8898";
  var STORE_KEY = "swt-chat-v1";

  var SUGGESTIONS = [
    "How much is the Echo Lake shuttle?",
    "Can I bring my dog?",
    "What tours do you run?",
    "Do I need a licence to rent the boat?",
    "Can you pick us up in Vancouver?",
  ];

  var GREETING =
    "Hey! I can answer pretty much anything about our water taxi, Echo Lake shuttle, tours, and boat rentals - prices, pickup spots, dogs, what to bring. What can I help with?";

  /* ---- Session state (survives page navigation within the tab) ---- */
  var state = { history: [], formShown: false, leadFiled: false, teaserDismissed: false };
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
    if (saved && Array.isArray(saved.history)) state = saved;
  } catch (e) {}
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---- Styles ---- */
  var css = `
  .swtc-launch{position:fixed;right:20px;bottom:20px;z-index:9000;display:flex;align-items:center;gap:.5rem;
    background:var(--gold-500,#f59e0b);color:#1c1305;border:none;border-radius:999px;padding:.85rem 1.25rem .85rem 1rem;
    font-weight:700;font-size:.95rem;line-height:1;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);transition:transform .15s,background-color .15s}
  .swtc-launch:hover{background:var(--gold-400,#fbbf24);transform:translateY(-2px)}
  .swtc-launch svg{width:22px;height:22px;flex:none}
  .swtc-launch .swtc-dot{width:9px;height:9px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 2px #1c1305}
  .swtc-teaser{position:fixed;right:20px;bottom:84px;z-index:9000;max-width:270px;background:#fff;color:#0f172a;
    border-radius:14px 14px 4px 14px;padding:.85rem 2rem .85rem 1rem;font-size:.9rem;line-height:1.4;
    box-shadow:0 10px 30px rgba(0,0,0,.4);cursor:pointer;animation:swtc-pop .35s ease-out}
  .swtc-teaser b{display:block;margin-bottom:.15rem}
  .swtc-teaser-x{position:absolute;top:4px;right:6px;background:none;border:none;color:#64748b;font-size:1.1rem;cursor:pointer;padding:4px 6px;line-height:1}
  @keyframes swtc-pop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
  .swtc-panel{position:fixed;right:20px;bottom:20px;z-index:9001;width:380px;max-width:calc(100vw - 32px);
    height:min(600px,calc(100vh - 40px));display:none;flex-direction:column;background:var(--slate-900,#0f172a);
    border:1px solid var(--slate-700,#334155);border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.6);color:var(--slate-200,#e2e8f0)}
  .swtc-panel.open{display:flex;animation:swtc-pop .25s ease-out}
  .swtc-head{display:flex;align-items:center;gap:.75rem;padding:.9rem 1rem;background:var(--slate-950,#020617);border-bottom:1px solid var(--slate-800,#1e293b)}
  .swtc-avatar{width:36px;height:36px;border-radius:50%;background:var(--gold-500,#f59e0b);display:grid;place-items:center;flex:none}
  .swtc-avatar svg{width:20px;height:20px}
  .swtc-title{font-weight:700;color:#fff;font-size:.95rem}
  .swtc-sub{font-size:.75rem;color:var(--slate-400,#94a3b8);display:flex;align-items:center;gap:.35rem}
  .swtc-sub::before{content:"";width:7px;height:7px;border-radius:50%;background:#16a34a}
  .swtc-close{margin-left:auto;background:none;border:none;color:var(--slate-400,#94a3b8);font-size:1.5rem;cursor:pointer;line-height:1;padding:.25rem .4rem}
  .swtc-close:hover{color:#fff}
  .swtc-msgs{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem}
  .swtc-msg{max-width:85%;padding:.65rem .85rem;border-radius:14px;font-size:.9rem;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
  .swtc-msg.bot{background:var(--slate-800,#1e293b);align-self:flex-start;border-bottom-left-radius:4px}
  .swtc-msg.user{background:var(--gold-500,#f59e0b);color:#1c1305;align-self:flex-end;border-bottom-right-radius:4px}
  .swtc-typing{display:flex;gap:4px;align-items:center}
  .swtc-typing span{width:7px;height:7px;border-radius:50%;background:var(--slate-400,#94a3b8);animation:swtc-b 1s infinite}
  .swtc-typing span:nth-child(2){animation-delay:.15s}.swtc-typing span:nth-child(3){animation-delay:.3s}
  @keyframes swtc-b{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}
  .swtc-chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.1rem}
  .swtc-chip{background:transparent;border:1px solid var(--gold-600,#d97706);color:var(--gold-400,#fbbf24);border-radius:999px;
    padding:.4rem .75rem;font-size:.8rem;cursor:pointer;font-family:inherit;text-align:left}
  .swtc-chip:hover{background:rgba(245,158,11,.12)}
  .swtc-form{display:flex;gap:.5rem;padding:.75rem;border-top:1px solid var(--slate-800,#1e293b);background:var(--slate-950,#020617)}
  .swtc-input{flex:1;min-width:0;background:var(--slate-800,#1e293b);border:1px solid var(--slate-700,#334155);color:#fff;border-radius:10px;
    padding:.7rem .8rem;font-size:16px;font-family:inherit}
  .swtc-input:focus{outline:none;border-color:var(--gold-500,#f59e0b)}
  .swtc-send{background:var(--gold-500,#f59e0b);border:none;border-radius:10px;width:44px;cursor:pointer;display:grid;place-items:center;flex:none}
  .swtc-send:disabled,.swtc-input:disabled{opacity:.5}
  .swtc-send svg{width:18px;height:18px}
  .swtc-lead{background:var(--slate-800,#1e293b);border:1px solid var(--gold-600,#d97706);border-radius:14px;padding:.85rem;display:flex;flex-direction:column;gap:.45rem;align-self:stretch}
  .swtc-lead p{margin:0 0 .2rem;font-size:.88rem;line-height:1.4}
  .swtc-lead input,.swtc-lead textarea{background:var(--slate-900,#0f172a);border:1px solid var(--slate-700,#334155);color:#fff;border-radius:8px;padding:.55rem .65rem;font-size:16px;font-family:inherit}
  .swtc-lead textarea{min-height:56px;resize:vertical}
  .swtc-lead-row{display:flex;gap:.45rem}.swtc-lead-row input{flex:1;min-width:0}
  .swtc-lead-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.15rem}
  .swtc-lead-actions button{border-radius:8px;padding:.5rem .85rem;font-size:.85rem;font-weight:600;cursor:pointer;font-family:inherit}
  .swtc-lead-skip{background:none;border:1px solid var(--slate-600,#475569);color:var(--slate-300,#cbd5e1)}
  .swtc-lead-send{background:var(--gold-500,#f59e0b);border:none;color:#1c1305}
  .swtc-lead-err{color:#fca5a5;font-size:.8rem;min-height:0}
  body.swtc-open .swtc-launch,body.swtc-open .swtc-teaser{display:none}
  @media (max-width:480px){
    .swtc-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100dvh;border-radius:0;border:none}
    .swtc-launch{right:16px;bottom:16px}.swtc-teaser{right:16px;bottom:78px}
  }`;
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_ANCHOR = '<svg viewBox="0 0 24 24" fill="none" stroke="#1c1305" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="#1c1305" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  /* ---- DOM ---- */
  var launch = document.createElement("button");
  launch.type = "button";
  launch.className = "swtc-launch";
  launch.setAttribute("aria-label", "Open chat - ask us anything");
  launch.innerHTML = ICON_CHAT + "<span>Ask us anything</span><span class=\"swtc-dot\"></span>";

  var panel = document.createElement("div");
  panel.className = "swtc-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with Squamish Water Taxi");
  panel.innerHTML =
    '<div class="swtc-head"><div class="swtc-avatar">' + ICON_ANCHOR + '</div>' +
    '<div><div class="swtc-title">Squamish Water Taxi</div><div class="swtc-sub">Answers instantly, 24/7</div></div>' +
    '<button type="button" class="swtc-close" aria-label="Close chat">&times;</button></div>' +
    '<div class="swtc-msgs" aria-live="polite"></div>' +
    '<form class="swtc-form"><input class="swtc-input" type="text" placeholder="Ask a question..." aria-label="Your message" maxlength="600" autocomplete="off">' +
    '<button class="swtc-send" type="submit" aria-label="Send">' + ICON_SEND + '</button></form>';

  document.body.appendChild(launch);
  document.body.appendChild(panel);

  var msgs = panel.querySelector(".swtc-msgs");
  var form = panel.querySelector(".swtc-form");
  var input = panel.querySelector(".swtc-input");
  var sendBtn = panel.querySelector(".swtc-send");
  var chipsEl = null;
  var teaser = null;

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "swtc-msg " + (role === "user" ? "user" : "bot");
    el.textContent = text;
    msgs.appendChild(el);
    scrollDown();
    return el;
  }

  function addChips() {
    chipsEl = document.createElement("div");
    chipsEl.className = "swtc-chips";
    SUGGESTIONS.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "swtc-chip";
      b.textContent = q;
      b.addEventListener("click", function () { send(q); });
      chipsEl.appendChild(b);
    });
    msgs.appendChild(chipsEl);
  }

  function renderAll() {
    msgs.innerHTML = "";
    addMsg("bot", GREETING);
    state.history.forEach(function (m) { addMsg(m.role === "user" ? "user" : "bot", m.content); });
    if (!state.history.length) addChips();
  }

  function openChat() {
    if (!msgs.childNodes.length) renderAll();
    panel.classList.add("open");
    document.body.classList.add("swtc-open");
    dismissTeaser();
    setTimeout(function () { input.focus(); }, 30);
    scrollDown();
  }
  function closeChat() {
    panel.classList.remove("open");
    document.body.classList.remove("swtc-open");
  }

  function dismissTeaser() {
    if (teaser) { teaser.remove(); teaser = null; }
    if (!state.teaserDismissed) { state.teaserDismissed = true; save(); }
  }

  launch.addEventListener("click", openChat);
  panel.querySelector(".swtc-close").addEventListener("click", closeChat);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeChat(); });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-open-chat]");
    if (t) { e.preventDefault(); openChat(); }
  });

  /* ---- Teaser bubble: makes it obvious you can just ask ---- */
  if (!state.teaserDismissed && !state.history.length) {
    setTimeout(function () {
      if (panel.classList.contains("open") || state.teaserDismissed) return;
      teaser = document.createElement("div");
      teaser.className = "swtc-teaser";
      teaser.innerHTML = "<b>Got a question? 👋</b>Prices, pickup spots, dogs, what to bring - ask me, I answer instantly." +
        '<button type="button" class="swtc-teaser-x" aria-label="Dismiss">&times;</button>';
      teaser.addEventListener("click", function (e) {
        if (e.target.classList.contains("swtc-teaser-x")) { e.stopPropagation(); dismissTeaser(); return; }
        openChat();
      });
      document.body.appendChild(teaser);
    }, 3500);
  }

  /* ---- Inline "send to the captain" form ---- */
  function addLeadForm() {
    state.formShown = true;
    save();
    var wrap = document.createElement("div");
    wrap.className = "swtc-lead";
    wrap.innerHTML =
      "<p>I'll send this straight to our captain - they'll confirm by text or phone.</p>" +
      '<input class="lf-name" type="text" placeholder="Your name" autocomplete="name">' +
      '<div class="swtc-lead-row"><input class="lf-phone" type="tel" placeholder="Phone" autocomplete="tel">' +
      '<input class="lf-email" type="email" placeholder="Email" autocomplete="email"></div>' +
      '<div class="swtc-lead-row"><input class="lf-date" type="text" placeholder="Date"><input class="lf-party" type="text" placeholder="# of people"></div>' +
      '<textarea class="lf-msg" placeholder="Where to / anything else?"></textarea>' +
      '<div class="swtc-lead-err"></div>' +
      '<div class="swtc-lead-actions"><button type="button" class="swtc-lead-skip">Not now</button>' +
      '<button type="button" class="swtc-lead-send">Send to captain</button></div>';
    msgs.appendChild(wrap);
    scrollDown();

    var err = wrap.querySelector(".swtc-lead-err");
    wrap.querySelector(".swtc-lead-skip").addEventListener("click", function () { wrap.remove(); });
    wrap.querySelector(".swtc-lead-send").addEventListener("click", function () {
      var v = function (c) { return wrap.querySelector(c).value.trim(); };
      var name = v(".lf-name"), phone = v(".lf-phone"), email = v(".lf-email");
      if (!name || (!phone && !email)) { err.textContent = "Please add your name and a phone number or email."; return; }
      if (email && email.indexOf("@") < 0) { err.textContent = "That email doesn't look right."; return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = "Sending...";
      fetch(CHAT_ENDPOINT + "/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name, phone: phone, email: email, date: v(".lf-date"), partySize: v(".lf-party"),
          message: v(".lf-msg"), transcript: state.history, source: "chatbot-form",
        }),
      })
        .then(function (r) { return r.json().then(function (o) { if (!r.ok || !o.ok) throw new Error(); }); })
        .then(function () {
          state.leadFiled = true;
          save();
          wrap.remove();
          var thanks = "Thanks " + name.split(" ")[0] + "! I've sent that to our captain - you'll hear back by text or phone soon.";
          addMsg("bot", thanks);
          state.history.push({ role: "assistant", content: thanks });
          save();
        })
        .catch(function () {
          err.textContent = "Couldn't send that - try again, or call/text " + PHONE + ".";
          btn.disabled = false;
          btn.textContent = "Send to captain";
        });
    });
  }

  /* ---- Send a chat message ---- */
  var busy = false;
  function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    if (chipsEl) { chipsEl.remove(); chipsEl = null; }
    addMsg("user", text);
    state.history.push({ role: "user", content: text });
    save();
    input.value = "";
    input.disabled = sendBtn.disabled = true;

    var typing = document.createElement("div");
    typing.className = "swtc-msg bot swtc-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(typing);
    scrollDown();

    fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: state.history.slice(-12), formShown: state.formShown, leadFiled: state.leadFiled }),
    })
      .then(function (r) { return r.json().then(function (o) { if (!r.ok || !o.reply) throw new Error(); return o; }); })
      .then(function (out) {
        typing.remove();
        addMsg("bot", out.reply);
        state.history.push({ role: "assistant", content: out.reply });
        if (out.leadCaptured) state.leadFiled = true;
        save();
        if (out.showContactForm && !state.formShown && !state.leadFiled) addLeadForm();
      })
      .catch(function () {
        typing.remove();
        addMsg("bot", "Sorry, I'm having trouble right now - try again, or call/text us at " + PHONE + ".");
      })
      .then(function () {
        busy = false;
        input.disabled = sendBtn.disabled = false;
        input.focus();
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    send(input.value);
  });
})();
