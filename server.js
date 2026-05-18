const express = require('express');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const supabase = require('./supabase');
const { toLowerKeys, settingsToCamel } = require('./db-helpers');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieSession({
  name: 'ndola_session',
  secret: 'ndola-hill-college-secret-2026',
  maxAge: 24 * 60 * 60 * 1000
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- DEBUG LOGGER ----------
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('⚡ POST', req.url);
    // Capture body once parsed
    req.on('end', () => {
      if (req.body) console.log('   Body:', JSON.stringify(req.body).substring(0,200));
    });
  }
  next();
});

// Global settings
app.use(async (req, res, next) => {
  try {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    res.locals.site = settingsToCamel(data || {});
  } catch (e) { res.locals.site = {}; }
  next();
});

// No cache for HTML
app.use((req, res, next) => {
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/)) return next();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
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
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  await supabase.from('messages').insert({ name, email, message, created_at: new Date() });
  res.render('contact', { success: true });
});
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
  const uploadFile = async (file, folder) => {
    if (!file) return '';
    const filename = folder + '/' + Date.now() + '-' + file.originalname;
    const { error } = await supabase.storage
      .from('uploads')
      .upload(filename, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) console.error('Upload error:', error.message);
    return error ? '' : `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/${filename}`;
  };
  const grade12Url = req.files.grade12 ? await uploadFile(req.files.grade12[0], 'applications') : '';
  const nrcUrl = req.files.nrc_copy ? await uploadFile(req.files.nrc_copy[0], 'applications') : '';
  const photoUrl = req.files.photo ? await uploadFile(req.files.photo[0], 'applications') : '';
  const { data: existing } = await supabase.from('applications').select('id');
  const maxNum = Math.max(0, ...(existing || []).map(a => parseInt(a.id.slice(3)) || 0));
  const newId = 'APP' + (maxNum + 1).toString().padStart(3, '0');
  const newApp = {
    id: newId, fullname: req.body.fullName || '', nrc: req.body.nrc || '', phone: req.body.phone || '',
    email: req.body.email || '', program: req.body.program || '', year: req.body.year || '',
    status: 'Pending', date: new Date().toISOString().slice(0,10), dob: req.body.dob || '',
    gender: req.body.gender || '', nationality: req.body.nationality || '', address: req.body.address || '',
    school: req.body.school || '', yearcompleted: req.body.yearCompleted || '', motivation: req.body.motivation || '',
    documents: { grade12: grade12Url, nrc_copy: nrcUrl, photo: photoUrl }
  };
  await supabase.from('applications').insert(toLowerKeys(newApp));
  res.render('apply_success', { applicationId: newId, programs: [] });
});
app.get('/track', (req, res) => res.render('track', { error: null }));
app.post('/track/status', async (req, res) => {
  const { data: app } = await supabase.from('applications').select('*').eq('id', req.body.appId).eq('nrc', req.body.nrc).single();
  if (!app) return res.render('track', { error: 'Application not found.' });
  res.render('status', { application: toLowerKeys(app) });
});
app.get('/acceptance/:id', async (req, res) => {
  const { data: app } = await supabase.from('applications').select('*').eq('id', req.params.id).single();
  if (!app || app.status !== 'Approved') return res.status(404).send('Not available.');
  if (req.query.nrc !== app.nrc) return res.status(403).send('Access denied.');
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  res.render('acceptance_letter', {
    application: toLowerKeys(app),
    college: { name: settings.collegename, address: settings.address, email: settings.email, phone: settings.phone, logo: settings.logo, primarycolor: settings.primarycolor || '#0b5e2f' }
  });
});
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
  res.render('dashboard', { applications: apps.map(toLowerKeys), programs: programs || [], pending, approved });
});

app.get('/admin/applications', async (req, res) => {
  const { data } = await supabase.from('applications').select('*').neq('status', 'Approved');
  res.render('applications', { applications: (data || []).map(toLowerKeys) });
});

app.get('/admin/students', async (req, res) => {
  const { data } = await supabase.from('applications').select('*').eq('status', 'Approved');
  const students = (data || []).map(toLowerKeys);
  res.render('students', { students, notifyId: req.query.notifyId || null });
});

app.get('/admin/review', async (req, res) => {
  const { data } = await supabase.from('applications').select('*').eq('status', 'Rejected');
  res.render('review', { applications: (data || []).map(toLowerKeys) });
});

// THE ACCEPT/REJECT ROUTE
app.post('/admin/review/:id', requireAuth, async (req, res) => {
  await supabase.from('applications').update({ status: req.body.status }).eq('id', req.params.id);
  res.redirect(req.body.status === 'Approved' ? '/admin/students?notifyId=' + req.params.id : '/admin/review');
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
    fullname: req.body.fullName || req.body.fullname, phone: req.body.phone,
    email: req.body.email, program: req.body.program, year: req.body.year
  }).eq('id', req.params.id);
  res.redirect('/admin/applications');
});
app.post('/admin/documents/delete', async (req, res) => {
  const { appId, field, filename } = req.body;
  await supabase.storage.from('uploads').remove([`applications/${filename}`]);
  const { data: app } = await supabase.from('applications').select('documents').eq('id', appId).single();
  if (app) { const docs = app.documents || {}; docs[field] = ''; await supabase.from('applications').update({ documents: docs }).eq('id', appId); }
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
  if (data) { res.setHeader('Content-Type', data.type); res.send(Buffer.from(await data.arrayBuffer())); }
  else res.status(404).send('File not found');
});

// Programs CRUD
app.get('/admin/programs', async (req, res) => {
  const { data } = await supabase.from('programs').select('*');
  res.render('programs_admin', { programs: data || [] });
});
app.get('/admin/programs/add', (req, res) => res.render('program_form', { program: null }));
app.get('/admin/programs/edit/:id', async (req, res) => {
  const { data: program } = await supabase.from('programs').select('*').eq('id', req.params.id).single();
  res.render('program_form', { program: program || null });
});

// THE PROGRAM SAVE ROUTE (accepts empty strings)

app.post('/admin/programs/save', upload.single('image'), async (req, res) => {
  const { id, name, type, duration, fee, capacity, applicationfee, description } = req.body;
  const entryrequirements = req.body.entryrequirements;
  let imagePath = '';
  if (req.file) {
    const filename = 'programs/' + Date.now() + '-' + req.file.originalname;
    await supabase.storage.from('uploads').upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    imagePath = `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/${filename}`;
  }

  // Build update object with **explicit lowercase keys** matching the database
  const dataToSave = {
    name: name,
    type: type,
    duration: duration,
    fee: parseInt(fee) || 0,
    capacity: parseInt(capacity) || 0,
    applicationfee: parseInt(applicationfee) || 0,
    entryrequirements: entryrequirements !== undefined ? entryrequirements : '',
    description: description !== undefined ? description : ''
  };
  if (imagePath) dataToSave.image = imagePath;

  console.log('Saving program with keys:', Object.keys(dataToSave));
  console.log('Values:', dataToSave);

  if (id) {
    const { error } = await supabase
      .from('programs')
      .update(dataToSave)
      .eq('id', id);
    if (error) console.error('❌ Update error:', error.message);
    else console.log('✅ Update successful for', id);
  } else {
    const { data: existing } = await supabase.from('programs').select('id');
    const maxNum = Math.max(0, ...(existing || []).map(p => parseInt(p.id.slice(1)) || 0));
    const newId = 'P' + (maxNum + 1).toString().padStart(3, '0');
    dataToSave.id = newId;
    const { error } = await supabase.from('programs').insert(dataToSave);
    if (error) console.error('❌ Insert error:', error.message);
    else console.log('✅ Insert successful for', newId);
  }
  res.redirect('/admin/programs');
});
app.post('/admin/programs/delete/:id', async (req, res) => {
  await supabase.from('programs').delete().eq('id', req.params.id);
  res.redirect('/admin/programs');
});

// Partners, Gallery, Settings (identical to last full version, but I'll include them for completeness)
app.get('/admin/partners', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('partners').eq('id', 1).single();
  res.render('partners_admin', { partners: (settings && settings.partners) ? settings.partners : [] });
});
app.post('/admin/partners/add', upload.single('logo'), async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const partners = settings.partners || [];
  let logoPath = '';
  if (req.file) {
    const filename = 'partners/' + Date.now() + '-' + req.file.originalname;
    await supabase.storage.from('uploads').upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    logoPath = `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/${filename}`;
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

app.get('/admin/gallery', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('gallery').eq('id', 1).single();
  res.render('gallery_admin', { gallery: (settings && settings.gallery) ? settings.gallery : [] });
});
app.post('/admin/gallery/upload', upload.array('images', 10), async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  const gallery = settings.gallery || [];
  for (const file of req.files) {
    const filename = 'gallery/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + file.originalname;
    await supabase.storage.from('uploads').upload(filename, file.buffer, { contentType: file.mimetype, upsert: true });
    gallery.push({ id: Date.now().toString() + Math.random(), path: `https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/${filename}` });
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

app.get('/admin/settings', async (req, res) => {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
  res.render('settings', { settings: settingsToCamel(settings || {}), success: req.query.success ? 'Settings saved.' : null });
});

app.post('/admin/settings', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'headerBg', maxCount: 1 },
  { name: 'heroBg', maxCount: 1 },
  { name: 'trustBadge1', maxCount: 1 },
  { name: 'trustBadge2', maxCount: 1 },
  { name: 'trustBadge3', maxCount: 1 },
  { name: 'trustBadge4', maxCount: 1 }
]), async (req, res) => {
  const { data: current } = await supabase.from('settings').select('*').eq('id', 1).single();
  const prev = current || {};
  const updateObj = {
    collegename: req.body.collegeName || prev.collegename,
    motto: req.body.motto || prev.motto,
    vision: req.body.vision || prev.vision,
    email: req.body.email || prev.email,
    phone: req.body.phone || prev.phone,
    address: req.body.address || prev.address,
    alloweduploadformats: req.body.allowedUploadFormats || prev.alloweduploadformats,
    alloweddownloadformats: req.body.allowedDownloadFormats || prev.alloweddownloadformats,
    primarycolor: req.body.primaryColor || prev.primarycolor || '#0b5e2f',
    accentcolor: req.body.accentColor || prev.accentcolor || '#d4a017',
    herocolor: req.body.heroColor || prev.herocolor || '#0b5e2f',
    stat_graduates: req.body.statGraduates || prev.stat_graduates || '2500+',
    stat_employment_rate: req.body.statEmploymentRate || prev.stat_employment_rate || '87%',
    stat_jobs: req.body.statJobs || prev.stat_jobs || '13,000+',
    stat_programmes: req.body.statProgrammes || prev.stat_programmes || '15+',
    smtp_host: req.body.smtpHost || prev.smtp_host || '',
    smtp_port: req.body.smtpPort || prev.smtp_port || '587',
    smtp_user: req.body.smtpUser || prev.smtp_user || '',
    smtp_pass: req.body.smtpPass || prev.smtp_pass || '',
    smtp_from: req.body.smtpFrom || prev.smtp_from || ''
  };

  const uploadFile = async (file, folder) => {
    if (!file) return null;
    const filename = folder + '/' + Date.now() + '-' + file.originalname;
    const { error } = await supabase.storage
      .from('uploads')
      .upload(filename, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) { console.error('Upload error:', error.message); return null; }
    return 'https://dckmoxtqsklegeetcgyl.supabase.co/storage/v1/object/public/uploads/' + filename;
  };

  if (req.files) {
    if (req.files.logo && req.files.logo[0]) { const url = await uploadFile(req.files.logo[0], 'logo'); if (url) updateObj.logo = url; }
    if (req.files.headerBg && req.files.headerBg[0]) { const url = await uploadFile(req.files.headerBg[0], 'headerbg'); if (url) updateObj.headerbg = url; }
    if (req.files.heroBg && req.files.heroBg[0]) { const url = await uploadFile(req.files.heroBg[0], 'hero'); if (url) updateObj.herobg = url; }
    for (let i = 1; i <= 4; i++) {
      const fieldName = 'trustBadge' + i;
      const dbKey = 'trustbadge' + i;
      if (req.files[fieldName] && req.files[fieldName][0]) {
        const url = await uploadFile(req.files[fieldName][0], 'badges');
        if (url) updateObj[dbKey] = url;
      }
    }
  }

  const { error } = await supabase.from('settings').update(updateObj).eq('id', 1);
  if (error) { console.error('Settings update error:', error.message); return res.status(500).send('Failed to save settings.'); }
  res.redirect('/admin/settings?success=1');
});

app.get('/admin/settings/delete-image', async (req, res) => {
  const field = req.query.field;
  const dbField = field.toLowerCase();
  if (!dbField) return res.redirect('/admin/settings');
  const { data: settings } = await supabase.from('settings').select(dbField).eq('id', 1).single();
  if (settings && settings[dbField]) {
    const url = settings[dbField];
    const parts = url.split('/');
    const path = parts.slice(parts.indexOf('uploads') + 1).join('/');
    await supabase.storage.from('uploads').remove([path]);
    await supabase.from('settings').update({ [dbField]: '' }).eq('id', 1);
  }
  res.redirect('/admin/settings');
});

app.post('/admin/settings/password', async (req, res) => {
  const hash = bcrypt.hashSync(req.body.newPassword, 10);
  await supabase.from('users').update({ password: hash }).eq('username', 'admin');
  res.redirect('/admin/settings?pw=1');
});

// 404 handler
app.use((req, res) => { res.status(404).render('404'); });

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
}
module.exports = app;
