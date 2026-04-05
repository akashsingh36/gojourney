console.log("App.js loaded 🚀");

// NOTE: window.App, handleLogin, handleSignup, loginUser, showToast, lsGet, lsSet are all
// defined in index.html's inline <script>. This file only provides the deleteUser helper.

// ================= DELETE USER =================
function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  fetch(`https://gojourney-production.up.railway.app/api/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + (localStorage.getItem("gj_token") || localStorage.getItem("token") || "")
    }
  })
  .then(res => res.json())
  .then(() => { refreshUsersTab(); })
  .catch(() => { refreshUsersTab(); });

  // Always remove locally
  App.users = App.users.filter(u => String(u._id || u.id) !== String(id));
  lsSet('gj_users', App.users);
  showToast("User deleted ✅");
  refreshUsersTab();
}

function refreshUsersTab() {
  const body = document.getElementById('adminBody');
  if (!body) return;
  body.innerHTML = `
    <h3 style="margin-bottom:16px">Registered Users (${App.users.length})</h3>
    <div style="overflow-x:auto">
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${App.users.map(u => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>${u.phone || '-'}</td>
              <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A'}</td>
              <td><button onclick="deleteUser('${u._id || u.id}')" style="font-size:11px;background:#fee2e2;color:#991b1b;padding:4px 10px;border-radius:4px;border:1px solid #fca5a5;cursor:pointer">🗑 Delete</button></td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">No users registered yet</td></tr>'}
        </tbody>
      </table>
    </div>`;
}