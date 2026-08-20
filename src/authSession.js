// Shared helper for the one merge-and-persist step every surface that logs a staff/admin account
// in (App.jsx's inline collector/cashier gate, StaffPortalGate.jsx) needs after a self-service
// profile edit (name/photo/password/phone numbers via the Account panel) comes back from the
// server: fold the patch into the current user object and write it back to the 'gurmadUser'
// localStorage key so the header/avatar reflect it immediately without a re-login. Was previously
// copy-pasted in both places — a fix to one (e.g. handling a null patch field) risked being
// applied to only one of the two.
export function mergeAndPersistUser(prevUser, patch) {
  const next = { ...prevUser, ...patch };
  localStorage.setItem('gurmadUser', JSON.stringify(next));
  return next;
}
