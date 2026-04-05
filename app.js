console.log("App.js loaded 🚀");

// ================= GLOBAL APP STATE =================
const App = {
  currentUser: null
};

// ================= TOAST =================
function showToast(msg) {
  alert(msg); // simple for now
}

// ================= LOGIN =================
function loginUser(user) {
  App.currentUser = user;
  localStorage.setItem("user", JSON.stringify(user));
}

// ================= SIGNUP =================
function handleSignup() {
  const firstName = document.getElementById('signupFirst').value.trim();
  const lastName = document.getElementById('signupLast').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPass').value;
  const phone = document.getElementById('signupPhone').value.trim();

  if (!firstName || !email || !password) {
    showToast('Please fill all required fields');
    return;
  }

  if (password.length < 8) {
    showToast('Password must be at least 8 characters');
    return;
  }

  fetch("https://gojourney-production.up.railway.app/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: firstName + (lastName ? ' ' + lastName : ''),
      email,
      password,
      phone
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log(data);

    if (data.error) {
      showToast(data.error);
      return;
    }

    showToast("Signup successful 🎉");

    localStorage.setItem("token", data.token);

    loginUser(data.user);
  })
  .catch(err => {
    console.error(err);
    showToast("Signup failed ❌");
  });
}

// ================= LOGIN =================
function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  fetch("https://gojourney-production.up.railway.app/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      showToast(data.error);
      return;
    }

    localStorage.setItem("token", data.token);
    loginUser(data.user);

    showToast("Login successful ✅");
  })
  .catch(err => {
    console.error(err);
    showToast("Login failed ❌");
  });
}

// ================= BOOK NOW =================
document.addEventListener("click", function (e) {
  const btn = e.target.closest("button");

  if (!btn) return;

  if (btn.innerText.includes("Book Now")) {
    console.log("Book button clicked");

    const card = btn.closest(".card, .hotel-card, .cab-card");

    let title = "Selected Item";
    if (card) {
      const nameEl = card.querySelector("h3, h4, .title");
      if (nameEl) title = nameEl.innerText;
    }

    alert(`Booking started for: ${title} 🚀`);
  }
});

// ================= DELETE USER =================
function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  fetch(`https://gojourney-production.up.railway.app/api/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + localStorage.getItem("token")
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log(data);

    if (data.error) {
      showToast(data.error);
      return;
    }

    showToast("User deleted ✅");
    location.reload();
  })
  .catch(err => {
    console.error(err);
    showToast("Delete failed ❌");
  });
}