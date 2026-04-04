// Test if JS is working
console.log("App.js loaded");

// Make all "Book Now" buttons clickable
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("button");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      alert("Button is working 🚀");
    });
  });
});