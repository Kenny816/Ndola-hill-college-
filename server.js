const express = require('express');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const supabase = require('./supabase');

const app = express();
const PORT = 3000;

// ---------- Static files (absolute path for Vercel) ----------
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Session (stored in cookie, no server memory) ----------
app.use(cookieSession({
  name: 'ndola_session',
  secret: 'ndola-hill-college-secret-2026',
  maxAge: 24 * 60 * 60 * 1000   // 24 hours
}));

// ---------- Multer (memory storage, 5 MB limit) ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }  // 5 MB
});

// ---------- Body parser ----------
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global settings middleware (same as before)
app.use(async (req, res, next) => {
  try {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    res.locals.site = data || {};
  } catch(e) { res.locals.site = {}; }
  next();
});

const requireAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/admin/login');
};

// ========== PUBLIC ROUTES ==========
app.get('/', async (req, res) => {
  const { data: programs } = await supabase.from('programs').select('*');
  res.render('home', { programs: programs || [], partners: [], testimonials: [] });
});

app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));

app.get('/programmes', async (req, res) => {
  const { data: programs } = await supabase.from('programs').select('*');
  res.render('programmes_public', { programs: programs || [] });
});

app.get('/program/:id', async (req, res) => {
  const { data: program } = await supabase.from('programs').select('*').eq('id', req.params.id).single();
  res.render('programme_detail', { program: program || null });
});

app.get('/apply', async (req, res) => {
  const { data: programs } = await supabase.from('programs').select('*');
  res.render('apply', { programs: programs || [] });
});

app.post('/apply', upload.fields([
  { name: 'grade12', maxCount: 1 },
  { name: 'nrc_copy', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), async (req, res) => {
  const uploadFile = async (file, filename) => {
    if (!file) return '';
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(`applications/${filename}`, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) console.error('Upload error:', error);
    return data ? `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/applications/${filename}` : '';
  };

  const grade12Url = req.files.grade12 ? await uploadFile(req.files.grade12[0], Date.now() + '-' + req.files.grade12[0].originalname) : '';
  const nrcUrl = req.files.nrc_copy ? await uploadFile(req.files.nrc_copy[0], Date.now() + '-' + req.files.nrc_copy[0].originalname) : '';
  const photoUrl = req.files.photo ? await uploadFile(req.files.photo[0], Date.now() + '-' + req.files.photo[0].originalname) : '';

  const { count } = await supabase.from('applications').select('id', { count: 'exact' });
  const newId = 'APP' + ((count || 0) + 1).toString().padStart(3, '0');

  await supabase.from('applications').insert({
    id: newId,
    fullName: req.body.fullName,
    nrc: req.body.nrc,
    phone: req.body.phone,
    email: req.body.email,
    program: req.body.program,
    year: req.body.year,
    status: 'Pending',
    date: new Date().toISOString().slice(0,10),
    dob: req.body.dob || '',
    gender: req.body.gender || '',
    nationality: req.body.nationality || '',
    address: req.body.address || '',
    school: req.body.school || '',
    yearCompleted: req.body.yearCompleted || '',
    motivation: req.body.motivation || '',
    documents: { grade12: grade12Url, nrc_copy: nrcUrl, photo: photoUrl }
  });

  const { data: programs } = await supabase.from('programs').select('*');
  res.render('apply_success', { applicationId: newId, programs: programs || [] });
});

// Tracking
app.get('/track', (req, res) => res.render('track', { error: null }));
app.post('/track/status', async (req, res) => {
  const { data: app } = await supabase.from('applications').select('*').eq('id', req.body.appId).eq('nrc', req.body.nrc).single();
  if (!app) return res.render('track', { error: 'Application not found.' });
  res.render('status', { application: app });
});

app.get('/acceptance/:id', async (req, res) => {
  const { data: app } = await supabase.from('applications').select('*').eq('id', req.params.id).single();
  if (!app || app.status !== 'Approved') return res.status(404).send('Not available.');
  if (req.query.nrc !== app.nrc) return res.status(403).send('Access denied.');
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  res.render('acceptance_letter', {
    application: app,
    college: { name: settings.collegeName, address: settings.address, email: settings.email, logo: settings.logo }
  });
});

// API
app.get('/api/programs', async (req, res) => {
  const { data } = await supabase.from('programs').select('*');
  res.json(data || []);
});

// ========== ADMIN ROUTES ==========
app.get('/admin/login', (req, res) => res.render('login', { error: null }));
app.post('/admin/login', async (req, res) => {
  const { data: user } = await supabase.from('users').select('*').eq('username', req.body.username).single();
  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    req.session.user = user;
    return res.redirect('/admin/dashboard');
  }
  res.render('login', { error: 'Invalid credentials' });
});

app.get('/admin/logout', (req, res) => { req.session = null; res.redirect('/admin/login'); });

app.use('/admin', requireAuth);

app.get('/admin/dashboard', async (req, res) => {
  const { data: applications } = await supabase.from('applications').select('*');
  const { data: programs } = await supabase.from('programs').select('*');
  const apps = applications || [];
  const pending = apps.filter(a => a.status === 'Pending').length;
  const approved = apps.filter(a => a.status === 'Approved').length;
  res.render('dashboard', { applications: apps, programs: programs || [], pending, approved });
});

app.get('/admin/applications', async (req, res) => {
  const { data } = await supabase.from('applications').select('*').neq('status', 'Approved');
  res.render('applications', { applications: data || [] });
});

app.get('/admin/students', async (req, res) => {
  const { data } = await supabase.from('applications').select('*').eq('status', 'Approved');
  res.render('students', { students: data || [] });
});

app.get('/admin/review', async (req, res) => {
  const { data } = await supabase.from('applications').select('*').eq('status', 'Rejected');
  res.render('review', { applications: data || [] });
});

app.post('/admin/review/:id', async (req, res) => {
  await supabase.from('applications').update({ status: req.body.status }).eq('id', req.params.id);
  res.redirect(req.body.status === 'Approved' ? '/admin/students' : '/admin/review');
});

app.post('/admin/applications/delete/:id', async (req, res) => {
  await supabase.from('applications').delete().eq('id', req.params.id);
  res.redirect('back');
});

app.post('/admin/students/notify/:id', async (req, res) => {
  await supabase.from('applications').update({ notified: true }).eq('id', req.params.id);
  res.redirect('/admin/students');
});

app.post('/admin/applications/edit/:id', async (req, res) => {
  await supabase.from('applications').update({
    fullName: req.body.fullName,
    phone: req.body.phone,
    email: req.body.email,
    program: req.body.program,
    year: req.body.year
  }).eq('id', req.params.id);
  res.redirect('/admin/applications');
});

app.post('/admin/documents/delete', async (req, res) => {
  const { appId, field, filename } = req.body;
  await supabase.storage.from('uploads').remove([`applications/${filename}`]);
  const { data: app } = await supabase.from('applications').select('documents').eq('id', appId).single();
  if (app) {
    const docs = app.documents || {};
    docs[field] = '';
    await supabase.from('applications').update({ documents: docs }).eq('id', appId);
  }
  res.redirect('back');
});

app.get('/admin/applications/export', async (req, res) => {
  const { data } = await supabase.from('applications').select('*');
  const { stringify } = require('csv-stringify/sync');
  const csv = stringify(data || [], { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
  res.send(csv);
});

app.get('/download/:filename', async (req, res) => {
  const { data, error } = await supabase.storage.from('uploads').download(`applications/${req.params.filename}`);
  if (data) {
    res.setHeader('Content-Type', data.type);
    res.send(Buffer.from(await data.arrayBuffer()));
  } else {
    res.status(404).send('File not found');
  }
});

// Programmes CRUD
app.get('/admin/programs', async (req, res) => {
  const { data } = await supabase.from('programs').select('*');
  res.render('programs_admin', { programs: data || [] });
});

app.get('/admin/programs/add', (req, res) => res.render('program_form', { program: null }));
app.get('/admin/programs/edit/:id', async (req, res) => {
  const { data: program } = await supabase.from('programs').select('*').eq('id', req.params.id).single();
  res.render('program_form', { program: program || null });
});

app.post('/admin/programs/save', upload.single('image'), async (req, res) => {
  const { id, name, type, duration, fee, capacity, applicationfee, entryrequirements, description } = req.body;
  let imagePath = '';

  if (req.file) {
    const filename = Date.now() + '-' + req.file.originalname;
    await supabase.storage.from('uploads').upload(`programs/${filename}`, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    imagePath = `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/programs/${filename}`;
  }

  const obj = { name, type, duration, fee: parseInt(fee), capacity: parseInt(capacity), applicationfee: parseInt(applicationfee), entryrequirements, description };
  if (imagePath) obj.image = imagePath;

  if (id) {
    await supabase.from('programs').update(obj).eq('id', id);
  } else {
    const { count } = await supabase.from('programs').select('id', { count: 'exact' });
    obj.id = 'P' + ((count || 0) + 1).toString().padStart(3, '0');
    await supabase.from('programs').insert(obj);
  }
  res.redirect('/admin/programs');
});

app.post('/admin/programs/delete/:id', async (req, res) => {
  await supabase.from('programs').delete().eq('id', req.params.id);
  res.redirect('/admin/programs');
});

// Partners
app.get('/admin/partners', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('partners').eq('id', 1).single();
  res.render('partners_admin', { partners: (settings && settings.partners) ? settings.partners : [] });
});

app.post('/admin/partners/add', upload.single('logo'), async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const partners = settings.partners || [];
  let logoPath = '';
  if (req.file) {
    const filename = Date.now() + '-' + req.file.originalname;
    await supabase.storage.from('uploads').upload(`partners/${filename}`, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    logoPath = `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/partners/${filename}`;
  }
  partners.push({ id: Date.now().toString(), name: req.body.name, logo: logoPath });
  await supabase.from('settings').update({ partners }).eq('id', 1);
  res.redirect('/admin/partners');
});

app.post('/admin/partners/delete/:id', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const partners = (settings.partners || []).filter(p => p.id !== req.params.id);
  await supabase.from('settings').update({ partners }).eq('id', 1);
  res.redirect('/admin/partners');
});

// Gallery
app.get('/admin/gallery', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('gallery').eq('id', 1).single();
  res.render('gallery_admin', { gallery: (settings && settings.gallery) ? settings.gallery : [] });
});

app.post('/admin/gallery/upload', upload.array('images', 10), async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const gallery = settings.gallery || [];
  for (const file of req.files) {
    const filename = Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + file.originalname;
    await supabase.storage.from('uploads').upload(`gallery/${filename}`, file.buffer, { contentType: file.mimetype, upsert: true });
    gallery.push({ id: Date.now().toString() + Math.random(), path: `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/gallery/${filename}` });
  }
  await supabase.from('settings').update({ gallery }).eq('id', 1);
  res.redirect('/admin/gallery');
});

app.post('/admin/gallery/delete/:id', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const gallery = (settings.gallery || []).filter(img => img.id !== req.params.id);
  await supabase.from('settings').update({ gallery }).eq('id', 1);
  res.redirect('/admin/gallery');
});

// Settings
app.get('/admin/settings', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  res.render('settings', { settings: settings || {}, success: null });
});

app.post('/admin/settings', upload.fields([
  { name: 'logo', maxCount: 1 }, { name: 'headerBg', maxCount: 1 }, { name: 'heroBg', maxCount: 1 },
  { name: 'trustBadge1', maxCount: 1 }, { name: 'trustBadge2', maxCount: 1 }, { name: 'trustBadge3', maxCount: 1 }, { name: 'trustBadge4', maxCount: 1 }
]), async (req, res) => {
  const updateObj = {};
  ['collegeName','email','phone','address','motto','vision','allowedUploadFormats','allowedDownloadFormats'].forEach(f => {
    if (req.body[f] !== undefined) updateObj[f] = req.body[f];
  });

  const uploadFile = async (file, folder) => {
    if (!file) return '';
    const filename = folder + '/' + Date.now() + '-' + file.originalname;
    await supabase.storage.from('uploads').upload(filename, file.buffer, { contentType: file.mimetype, upsert: true });
    return `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/${filename}`;
  };
  if (req.files.logo) updateObj.logo = await uploadFile(req.files.logo[0], 'logo');
  if (req.files.headerBg) updateObj.headerBg = await uploadFile(req.files.headerBg[0], 'headerbg');
  if (req.files.heroBg) updateObj.heroBg = await uploadFile(req.files.heroBg[0], 'hero');
  for (let i = 1; i <= 4; i++) {
    if (req.files[`trustBadge${i}`]) updateObj[`trustBadge${i}`] = await uploadFile(req.files[`trustBadge${i}`][0], 'badges');
  }

  await supabase.from('settings').update(updateObj).eq('id', 1);
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  res.render('settings', { settings, success: 'Settings saved.' });
});

app.get('/admin/settings/delete-image', async (req, res) => {
  const field = req.query.field;
  if (!field) return res.redirect('/admin/settings');
  const { data: settings } = await supabase.from('settings').select(field).eq('id', 1).single();
  if (settings && settings[field]) {
    const url = settings[field];
    const parts = url.split('/');
    const path = parts.slice(parts.indexOf('uploads') + 1).join('/');
    await supabase.storage.from('uploads').remove([path]);
    await supabase.from('settings').update({ [field]: '' }).eq('id', 1);
  }
  res.redirect('/admin/settings');
});

app.post('/admin/settings/password', async (req, res) => {
  const hash = bcrypt.hashSync(req.body.newPassword, 10);
  await supabase.from('users').update({ password: hash }).eq('username', 'admin');
  res.redirect('/admin/settings?pw=1');
});

// Vercel / local export
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
}
module.exports = app;
