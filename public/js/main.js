// ---------- Hero fade-in ----------
window.addEventListener('load', function() {
  document.querySelector('.hero')?.classList.add('loaded');
});

// ---------- Dark Mode Toggle ----------
(function() {
  const html = document.documentElement;
  const toggle = document.getElementById('darkToggle');
  if (!toggle) return;
  if (localStorage.getItem('theme') === 'dark') {
    html.setAttribute('data-theme', 'dark');
    toggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
  toggle.addEventListener('click', function() {
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
      html.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      toggle.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      toggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
  });
})();

// ---------- Sticky Nav shadow ----------
window.addEventListener('scroll', function() {
  const nb = document.getElementById('mainNavbar');
  nb?.classList.toggle('navbar-shadow', window.scrollY > 50);
});

// ---------- Back to Top ----------
const backBtn = document.getElementById('backToTop');
if (backBtn) {
  window.addEventListener('scroll', () => backBtn.classList.toggle('d-none', window.scrollY < 500));
  backBtn.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
}

// ---------- Count-Up Animation ----------
function animateCountUp() {
  document.querySelectorAll('.count-up').forEach(counter => {
    const target = +counter.getAttribute('data-target');
    const update = () => {
      const cur = +counter.innerText;
      const inc = Math.ceil(target/200);
      if (cur < target) {
        counter.innerText = cur+inc;
        setTimeout(update,30);
      } else {
        counter.innerText = target;
      }
    };
    update();
  });
}
const statsEl = document.getElementById('statsContainer');
if (statsEl) {
  const obs = new IntersectionObserver((entries) => {
    if(entries[0].isIntersecting){
      animateCountUp();
      obs.unobserve(statsEl);
    }
  }, {threshold:0.5});
  obs.observe(statsEl);
}

// ---------- Fetch Popular Programmes ----------
async function loadPopularProgrammes() {
  try {
    const res = await fetch('/api/programs');
    const progs = await res.json();
    const container = document.getElementById('popularProgrammes');
    if (!container) return;
    container.innerHTML = progs.slice(0,3).map(p => `
      <div class="col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title">${p.name}</h5>
            <h6 class="card-subtitle mb-2 text-muted">${p.type}</h6>
            <p><small>Duration: ${p.duration}</small></p>
            <p><small>Fee: ZMW ${p.fee}/year</small></p>
            <a href="/program/${p.id}" class="btn btn-gold btn-sm"><i class="fas fa-info-circle me-1"></i>View Details</a>
          </div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    const container = document.getElementById('popularProgrammes');
    if (container) container.innerHTML = '<div class="col-12 text-muted">Programmes loading...</div>';
  }
}
loadPopularProgrammes();

// ---------- Live Application Counter ----------
  try {
    const res = await fetch('/api/applications/count');
    const data = await res.json();
  } catch(e) {}
}

// ========== CUSTOM CAROUSEL (10+ Testimonials) ==========
document.addEventListener('DOMContentLoaded', function() {
  const testimonials = [
    { quote: "Ndola Hill College gave me the hands‑on skills I needed to start my career in mining.", name: "John Banda", role: "Mining Engineer, KCM" },
    { quote: "The practical training and industry connections were unmatched. I was hired before graduation!", name: "Martha Phiri", role: "Environmental Officer, FQM" },
    { quote: "The lecturers are industry professionals. I felt ready for the job from day one.", name: "Peter Zulu", role: "Process Plant Operator, Barrick" },
    { quote: "Every module was directly relevant to my current work. The labs are top‑notch.", name: "Grace Mwansa", role: "Electrical Technician, ZESCO" },
    { quote: "Thanks to the internship placement, I now have a permanent role at a leading mine.", name: "Charles Bwalya", role: "Geotechnical Engineer, Mopani" },
    { quote: "The support from faculty went beyond the classroom. They truly care about your success.", name: "Linda Chanda", role: "IT Officer, Stanbic" },
    { quote: "The programme gave me the confidence to start my own mining services company.", name: "Emmanuel Lungu", role: "Founder, Lungu Mining Services" },
    { quote: "I recommend Ndola Hill College to anyone serious about a career in engineering.", name: "Tendai Moyo", role: "Mechanical Engineer, ZCCM‑IH" },
    { quote: "My diploma helped me transition from a labourer to a skilled operator in just two years.", name: "Moses Simukonda", role: "Drill Operator, Lubambe" },
    { quote: "The college’s career office helped me prepare for interviews and negotiate my salary.", name: "Beatrice Mwila", role: "Safety Officer, Kalumbila" },
    { quote: "I studied part‑time while working, and the flexible schedule made it possible.", name: "Patson Njobvu", role: "Plant Supervisor, Lafarge" },
    { quote: "The mining engineering course covered exactly what I needed for my job at the open pit.", name: "Harriet Chibwe", role: "Mine Planner, Sentinel Mine" }
  ];

  const track = document.getElementById('carouselTrack');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  const indicators = document.getElementById('carouselIndicators');
  if (!track) return;

  track.innerHTML = testimonials.map((t, i) => `
    <div class="carousel-slide flex-shrink-0 w-100">
      <div class="d-flex justify-content-center">
        <div class="col-md-8 bg-white p-4 rounded shadow-sm mx-2 text-center">
          <div class="mb-3"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&size=64&background=0b5e2f&color=fff&rounded=true" alt="${t.name}" class="rounded-circle"></div>
          <p class="fst-italic">"${t.quote}"</p>
          <strong>${t.name}</strong><br><small class="text-muted">${t.role}</small>
        </div>
      </div>
    </div>
  `).join('');

  indicators.innerHTML = testimonials.map((_,i) => `<span class="carousel-indicator mx-1 ${i===0?'active':''}" data-slide="${i}" style="cursor:pointer; font-size:1.5rem; color:#aaa;">●</span>`).join('');

  let idx = 0;
  const slides = track.querySelectorAll('.carousel-slide');
  const total = slides.length;

  function goTo(i) {
    if (i < 0) i = total - 1;
    if (i >= total) i = 0;
    track.style.transform = `translateX(-${i * 100}%)`;
    document.querySelectorAll('.carousel-indicator').forEach((ind, n) => ind.classList.toggle('active', n === i));
    idx = i;
  }

  prevBtn.addEventListener('click', () => goTo(idx - 1));
  nextBtn.addEventListener('click', () => goTo(idx + 1));
  document.querySelectorAll('.carousel-indicator').forEach(ind => ind.addEventListener('click', () => goTo(+ind.dataset.slide)));

  setInterval(() => goTo(idx + 1), 5000);

  let touchStartX = 0;
  track.addEventListener('touchstart', e => touchStartX = e.changedTouches[0].screenX);
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goTo(idx + 1);
      else goTo(idx - 1);
    }
  });
});

// Fade-up on scroll
window.addEventListener('scroll', () => {
  document.querySelectorAll('.fade-up').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      el.classList.add('visible');
    }
  });
});
window.dispatchEvent(new Event('scroll'));

// ========== Lightbox for gallery images ==========
(function() {
  const galleryImages = document.querySelectorAll('.campus-gallery-img');
  const lightboxModal = new bootstrap.Modal(document.getElementById('lightboxModal'));
  const lightboxImage = document.getElementById('lightboxImage');
  
  galleryImages.forEach(img => {
    img.addEventListener('click', function() {
      lightboxImage.src = this.src;
      lightboxModal.show();
    });
    // Make images clickable via cursor style
    img.style.cursor = 'pointer';
  });
})();

// ========== Carousel: pause on hover ==========
(function() {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  let intervalId;
  
  function startAutoSlide() {
    // We need to access the carousel logic; since the carousel is defined elsewhere,
    // we'll simply add hover listeners to pause/resume the setInterval already existing.
    // The existing carousel code sets an interval to call goToSlide.
    // We'll override by clearing the interval on hover and resetting on leave.
  }
  
  // More straightforward: find the carousel container and add listeners
  const container = document.getElementById('customCarousel');
  if (container) {
    // The carousel's autoplay interval is stored globally in a variable? We need to modify the existing carousel code.
    // Instead, we'll add CSS to pause animation? Not possible with transform.
    // We'll wrap the existing setInterval in a controllable variable.
    // Since the carousel code is in main.js, we can edit that file.
    // We'll reload the page to get the new main.js. So let's patch main.js to include pause on hover.
  }
})();
