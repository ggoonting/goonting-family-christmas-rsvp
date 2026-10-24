const config = window.RSVP_CONFIG || {};
const lookupForm = document.querySelector('#lookup-form');
const rsvpWrap = document.querySelector('#rsvp-form-wrap');
const lookupMessage = document.querySelector('#lookup-message');
const formMessage = document.querySelector('#form-message');
const memberList = document.querySelector('#members-list');
let activeHousehold = null;

function setMessage(node, message, error = false) {
  node.textContent = message;
  node.classList.toggle('error', error);
}

async function callRsvp(payload) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('RSVPs are not set up yet. Please check back soon or contact your host.');
  }
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

function memberLabel(kind) {
  return ({ primary: 'Primary invitee', spouse: 'Spouse / partner', child: 'Child', infant: 'Infant' })[kind] || 'Family member';
}

function renderHousehold(household) {
  activeHousehold = household;
  document.querySelector('#household-name').textContent = household.name;
  memberList.replaceChildren();
  for (const member of household.members) {
    const row = document.createElement('div');
    row.className = 'member-row';
    const info = document.createElement('div'); info.className = 'member-info';
    const name = document.createElement('span'); name.className = 'member-name'; name.textContent = member.name;
    const type = document.createElement('span'); type.className = 'member-type';
    const infantDetail = member.kind === 'infant' && member.infant_details ? ` · ${member.infant_details}` : '';
    type.textContent = `${memberLabel(member.kind)}${infantDetail}`;
    info.append(name, type);
    const controls = document.createElement('div'); controls.className = 'member-controls'; controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', `RSVP for ${member.name}`);
    for (const [value, label] of [['yes', 'Joyfully yes'], ['no', 'Sorry, no']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'choice'; button.dataset.value = value; button.textContent = label;
      button.setAttribute('aria-pressed', String(member.rsvp === value));
      button.addEventListener('click', () => {
        member.rsvp = member.rsvp === value ? 'pending' : value;
        for (const option of controls.querySelectorAll('.choice')) option.setAttribute('aria-pressed', String(member.rsvp === option.dataset.value));
      });
      controls.append(button);
    }
    row.append(info, controls); memberList.append(row);
  }
  document.querySelector('#dish').value = household.meal_note || '';
  lookupForm.hidden = true; rsvpWrap.hidden = false; setMessage(lookupMessage, ''); setMessage(formMessage, '');
}

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = new FormData(lookupForm).get('code').trim();
  const button = lookupForm.querySelector('button'); button.disabled = true; button.textContent = 'Looking…';
  setMessage(lookupMessage, '');
  try {
    const household = await callRsvp({ action: 'lookup', code });
    renderHousehold(household);
  } catch (error) { setMessage(lookupMessage, error.message, true); }
  finally { button.disabled = false; button.innerHTML = 'Find my invite <span aria-hidden="true">→</span>'; }
});

document.querySelector('#change-household').addEventListener('click', () => {
  activeHousehold = null; rsvpWrap.hidden = true; lookupForm.hidden = false; lookupForm.reset(); lookupForm.querySelector('input').focus();
});

document.querySelector('#rsvp-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeHousehold) return;
  const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'Sending…';
  setMessage(formMessage, '');
  const token = new URLSearchParams(location.search).get('invite') || document.querySelector('#invite-code').value.trim();
  try {
    const saved = await callRsvp({ action: 'save', code: token, members: activeHousehold.members.map(({ id, rsvp }) => ({ id, rsvp })), meal_note: document.querySelector('#dish').value.trim() });
    setMessage(formMessage, saved.message || 'Your RSVP is saved. We can’t wait to celebrate with you!');
  } catch (error) { setMessage(formMessage, error.message, true); }
  finally { button.disabled = false; button.innerHTML = 'Send our RSVP <span aria-hidden="true">→</span>'; }
});

const inviteFromUrl = new URLSearchParams(location.search).get('invite');
if (inviteFromUrl) { document.querySelector('#invite-code').value = inviteFromUrl; lookupForm.requestSubmit(); }
