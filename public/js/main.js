document.addEventListener('DOMContentLoaded', function() {
  // Terms and conditions popup
  const termsLink = document.querySelector('.terms-link');
  const termsPopup = document.getElementById('termsPopup');
  const closeTerms = document.getElementById('closeTerms');
  
  if (termsLink && termsPopup) {
    termsLink.addEventListener('click', function(e) {
      e.preventDefault();
      termsPopup.style.display = 'flex';
    });
    
    closeTerms.addEventListener('click', function() {
      termsPopup.style.display = 'none';
    });
    
    // Close popup when clicking outside
    termsPopup.addEventListener('click', function(e) {
      if (e.target === termsPopup) {
        termsPopup.style.display = 'none';
      }
    });
  }
  
  // Handle dismissible error messages
  const errorMessage = document.querySelector('.error-message');
  if (errorMessage) {
    // Add a close button to the error message
    const closeButton = document.createElement('span');
    closeButton.innerHTML = '&times;';
    closeButton.style.float = 'right';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontWeight = 'bold';
    closeButton.style.fontSize = '20px';
    closeButton.style.marginLeft = '10px';
    
    closeButton.addEventListener('click', function() {
      errorMessage.style.display = 'none';
    });
    
    // Insert the close button at the beginning of the error message
    errorMessage.insertBefore(closeButton, errorMessage.firstChild);
  }
  
  // Form validation
  const loginForm = document.querySelector('.login-form form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      const termsCheckbox = this.querySelector('input[name="termsAccepted"]');
      if (!termsCheckbox.checked) {
        e.preventDefault();
        alert('You must accept the terms and conditions to continue.');
      }
    });
  }
  
  // Redirect counter on success page
  const countdown = document.getElementById('countdown');
  const statusLink = document.querySelector('.status-button');
  
  if (countdown && statusLink) {
    let count = parseInt(countdown.textContent);
    const timer = setInterval(function() {
      count--;
      countdown.textContent = count;
      
      if (count <= 0) {
        clearInterval(timer);
        window.location.href = statusLink.getAttribute('href');
      }
    }, 1000);
  }
});