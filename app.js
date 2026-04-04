console.log("App.js loaded");

// Handle Book Now click
document.addEventListener("click", function(e) {
  if (e.target.innerText.includes("Book Now")) {
    alert("Booking started 🚀");

    // You can later open booking modal here
    // openBookingModal();
  }
});