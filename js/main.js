// Copies a form submission into the CRM via the swt-chat Worker's /lead
// route (the Worker holds the CRM ingest key). Fire-and-forget: the
// Web3Forms email still goes out and is what the visitor's success message
// depends on, so a CRM hiccup never blocks or fails a submission.
const CRM_LEAD_ENDPOINT = 'https://swt-chat.thefulltimehobby.workers.dev/lead';
const SERVICE_LABELS = { 'water-taxi': 'Water Taxi', 'boat-rental': 'Boat Rental', 'both': 'Water Taxi + Boat Rental', 'inquiry': 'Other' };
function sendToCrm(fields) {
  try {
    fetch(CRM_LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
}

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
      sendToCrm({
        source: 'contact-form',
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        service: SERVICE_LABELS[formData.get('service')] || formData.get('service'),
        date: formData.get('date'),
        message: formData.get('message')
      });
      formData.append('access_key', 'a3e9ea73-311f-492a-85d4-c26d8d5b33bb');
      formData.append('subject', 'New Website Inquiry - Squamish Water Taxi');
      formData.append('from_name', 'Squamish Water Taxi Website');

      contactSubmitBtn.disabled = true;

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(response => response.json())
        .then(data => {
          if (!data.success) throw new Error('Request failed');
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
      if (!formData.get('botcheck')) {
        sendToCrm({
          source: 'updates-signup-form',
          email: formData.get('email'),
          message: 'Signed up for Highway 99 emergency response updates'
        });
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Subscribing...';
      subscribeMessage.textContent = '';
      subscribeMessage.className = 'emergency-message';

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      })
        .then(response => response.json())
        .then(data => {
          if (!data.success) throw new Error('Request failed');
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
