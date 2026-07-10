// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIconOpen = document.getElementById('menu-icon-open');
  const menuIconClose = document.getElementById('menu-icon-close');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function() {
      const isOpen = mobileMenu.classList.toggle('open');
      menuIconOpen.style.display = isOpen ? 'none' : 'block';
      menuIconClose.style.display = isOpen ? 'block' : 'none';
    });

    // Close mobile menu when clicking a link
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', function() {
        mobileMenu.classList.remove('open');
        menuIconOpen.style.display = 'block';
        menuIconClose.style.display = 'none';
      });
    });
  }

  // Contact Form Handling
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const contactSubmitBtn = contactForm.querySelector('button[type="submit"]');

    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const formData = new FormData(contactForm);
      formData.append('_subject', 'New Website Inquiry - Squamish Water Taxi');
      formData.append('_captcha', 'false');

      contactSubmitBtn.disabled = true;

      fetch('https://formsubmit.co/ajax/squamishwatertaxi@gmail.com', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(response => {
          if (!response.ok) throw new Error('Request failed');
          return response.json();
        })
        .then(() => {
          alert('Thank you for your inquiry! We\'ll get back to you soon.');
          contactForm.reset();
        })
        .catch(() => {
          alert('Something went wrong sending your message. Please try again, or call (604) 849-8898 or email squamishwatertaxi@gmail.com.');
        })
        .finally(() => {
          contactSubmitBtn.disabled = false;
        });
    });
  }

  // Emergency Response Updates Subscriber Form
  const subscribeForm = document.getElementById('subscribe-form');
  if (subscribeForm) {
    const subscribeMessage = document.getElementById('subscribe-message');
    const submitBtn = subscribeForm.querySelector('button[type="submit"]');

    subscribeForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const formData = new FormData(subscribeForm);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subscribing...';
      subscribeMessage.textContent = '';
      subscribeMessage.className = 'emergency-message';

      fetch('https://formsubmit.co/ajax/squamishwatertaxi@gmail.com', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(response => {
          if (!response.ok) throw new Error('Request failed');
          return response.json();
        })
        .then(() => {
          subscribeMessage.textContent = "You're on the list! We'll keep you updated on the emergency response plan.";
          subscribeMessage.classList.add('success');
          subscribeForm.reset();
        })
        .catch(() => {
          subscribeMessage.textContent = 'Something went wrong. Please try again, or email squamishwatertaxi@gmail.com.';
          subscribeMessage.classList.add('error');
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Keep Me Updated';
        });
    });
  }

  // Set active navigation link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
});
