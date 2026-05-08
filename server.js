const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PROGRAMS_FILE = path.join(DATA_DIR, 'programs.json');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helpers
function hashPassword(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }
function loadJSON(file, def) {
  if (!fs.existsSync(file)) return def;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return def; }
}
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }

// Init data
(function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  saveJSON(USERS_FILE, loadJSON(USERS_FILE, [{ username: 'admin', passwordHash: hashPassword('ndolahill2024') }]));

  saveJSON(PROGRAMS_FILE, loadJSON(PROGRAMS_FILE, [
    { id:'P001', name:'BSc Mining Engineering', capacity:120, fee:'ZMW 38,000/year',
      description:'This four‑year degree programme prepares students for careers in open‑pit and underground mining operations.' },
    { id:'P002', name:'Diploma in Mineral Processing', capacity:80, fee:'ZMW 22,000/year',
      description:'A two‑year diploma focusing on crushing, grinding, flotation, and smelting processes.' },
    { id:'P003', name:'Certificate in Environmental Management', capacity:60, fee:'ZMW 12,000',
      description:'A one‑year certificate covering environmental impact assessment, waste management, and sustainable mining.' },
    { id:'P004', name:'BSc Computer Science', capacity:150, fee:'ZMW 35,000/year',
      description:'A four‑year degree with specialisations in software engineering and data science.' },
    { id:'P005', name:'Diploma in Electrical Engineering', capacity:100, fee:'ZMW 20,000/year',
      description:'Hands‑on training in electrical power systems and industrial automation.' }
  ]));

  saveJSON(APPLICATIONS_FILE, loadJSON(APPLICATIONS_FILE, []));
})();

// Testimonials (static for now)
const testimonials = [
  { name: 'Benson Mwansa', role: 'Mining Engineer, First Quantum', quote: 'Ndola Hill College gave me the practical skills I needed to excel at Kansanshi.' },
  { name: 'Grace Chileshe', role: 'Environmental Officer, Barrick Gold', quote: 'The environmental management programme opened doors I never imagined.' },
  { name: 'Peter Zulu', role: 'Electrical Technician, Mopani', quote: 'The hands‑on training was exactly what the industry demanded.' }
];

// Partners
const partners = [
  { name: 'First Quantum Minerals', logo: 'https://via.placeholder.com/150x60/0b5e2f/white?text=FQM' },
  { name: 'Barrick Gold', logo: 'https://via.placeholder.com/150x60/0b5e2f/white?text=Barrick' },
  { name: 'Mopani Copper Mines', logo: 'https://via.placeholder.com/150x60/0b5e2f/white?text=Mopani' },
  { name: 'TEVETA', logo: 'https://via.placeholder.com/150x60/0b5e2f/white?text=TEVETA' }
];

// Middleware
app.use(bodyParser.urlencoded({ extended:true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const sessions = {};
function requireAuth(req, res, next) {
  const sid = req.cookies?.sessionId;
  if (sid && sessions[sid]) { req.session = sessions[sid]; return next(); }
  res.redirect('/admin/login');
}

// Public routes
app.get('/', (req,res) => res.render('home', { testimonials, partners }));
app.get('/about', (req,res) => res.render('about'));
app.get('/contact', (req,res) => res.render('contact'));
app.get('/programmes', (req,res) => {
  res.render('programmes_public', { programs: loadJSON(PROGRAMS_FILE) });
});
app.get('/programmes/:id', (req,res) => {
  const program = loadJSON(PROGRAMS_FILE).find(p => p.id === req.params.id);
  if (!program) return res.redirect('/programmes');
  res.render('programme_detail', { program });
});
app.get('/apply', (req,res) => {
  res.render('apply', { programs: loadJSON(PROGRAMS_FILE), error:null, success:null });
});
app.post('/apply', upload.fields([{name:'grade12File'},{name:'nrcFile'}]), (req,res) => {
  // ... application logic unchanged
  res.redirect('/apply?success=1');
});

// Admin routes (abbreviated)
app.get('/admin/login', (req,res) => res.render('login', { error:null }));
app.post('/admin/login', (req,res) => { /* ... */ res.redirect('/admin/dashboard'); });
// ... (all admin routes same as before)

app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));
