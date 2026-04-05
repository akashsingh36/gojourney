console.log("App.js loaded 🚀");

// ===== HANDLE BOOK NOW BUTTON =====
document.addEventListener("click", function (e) {
  const btn = e.target.closest("button");

  if (!btn) return;

  if (btn.innerText.includes("Book Now")) {
    console.log("Book button clicked");

    // Optional: get card details
    const card = btn.closest(".card, .hotel-card, .cab-card");

    let title = "Selected Item";
    if (card) {
      const nameEl = card.querySelector("h3, h4, .title");
      if (nameEl) title = nameEl.innerText;
    }

    alert(`Booking started for: ${title} 🚀`);

    // Future: open booking modal
    // openBookingModal(title);
  }
});


// ===== DELETE USER FUNCTION =====
function deleteUser(email) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  fetch(`https://gojourney-production.up.railway.app/api/auth/delete/${email}`, {
    method: "DELETE"
  })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      alert("User deleted ✅");
      location.reload();
    })
    .catch(err => {
      console.error(err);
      alert("Delete failed ❌");
    });
}