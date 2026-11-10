(() => {
  const config = window.OWLINA_SUPABASE;
  const showBootError = (message) => {
    const target = document.querySelector('#login-error');
    if (target) target.textContent = message;
  };
  if (!window.supabase?.createClient) {
    showBootError('Не вдалося завантажити модуль Supabase. Оновіть сторінку або відкрийте її в Chrome.');
    return;
  }
  if (!config?.url || !config?.publishableKey) {
    showBootError('Не знайдено налаштування підключення до Supabase.');
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey);
  const $ = (selector) => document.querySelector(selector);
  const state = { view: 'projects', projects: [], assets: [], projectMedia: [], gallery: [], query: '' };
  const titles = { projects: 'Проєкти', static: 'AI Static Creatives', video: 'AI Video', media: 'Медіатека' };
  const featuredLabels = { projects: 'На головній', static: 'На головній', video: 'На головній' };
  const categorySets = {
    static: [
      ['product', 'Товарка'], ['beauty', 'Beauty'], ['fashion', 'Fashion / Білизна'],
      ['furniture', 'Меблі'], ['jewelry', 'Ювелірка'], ['seasonal', 'Сезонні'],
      ['ads', 'Рекламні'], ['cinematic', 'Cinematic']
    ],
    video: [
      ['ads', 'Рекламні'], ['creative', 'Креативні'], ['fashion', 'Fashion'],
      ['animation', 'Анімація'], ['influencer', 'AI Інфлюенсер'], ['avatar', 'AI Аватар']
    ]
  };

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const fileName = (url = '') => decodeURIComponent(url.split('/').pop() || url).replace(/\?.*$/, '');
  const categoryOptions = (type, selected = []) => (categorySets[type] || []).map(([id, label]) =>
    `<label><input type="checkbox" name="categories" value="${id}" ${selected.includes(id) ? 'checked' : ''}>${label}</label>`
  ).join('');
  const posterFor = (asset) => {
    if (!asset) return '';
    if (asset.media_type === 'image') return asset.source_url;
    if (asset.poster_url) return asset.poster_url;
    return asset.source_url.replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto,w_600/').replace(/\.[^.?#]+(?:\?.*)?$/, '.jpg');
  };
  const uploadToCloudinary = (file, onProgress = () => {}) => new Promise((resolve, reject) => {
    const cloudinary = config.cloudinary || {};
    const isVideo = file.type.startsWith('video/');
    const maxSizeMb = isVideo ? 200 : 25;
    if (file.size > maxSizeMb * 1024 * 1024) {
      reject(new Error(`Файл завеликий. Максимум: ${maxSizeMb} МБ для ${isVideo ? 'відео' : 'зображення'}.`));
      return;
    }
    if (!cloudinary.cloudName || !cloudinary.uploadPreset) {
      reject(new Error('Спочатку потрібно підключити Cloudinary Upload Preset.'));
      return;
    }
    const request = new XMLHttpRequest();
    request.open('POST', `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/auto/upload`);
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      let result;
      try { result = JSON.parse(request.responseText); }
      catch { reject(new Error('Cloudinary повернув невідому відповідь.')); return; }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(result.error?.message || 'Не вдалося завантажити файл у Cloudinary.'));
        return;
      }
      resolve(result);
    });
    request.addEventListener('error', () => reject(new Error('Не вдалося підключитися до Cloudinary.')));
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', cloudinary.uploadPreset);
    request.send(body);
  });

  async function saveUploadedAsset(upload, title) {
    const payload = {
      source_url: upload.secure_url,
      media_type: upload.resource_type === 'video' ? 'video' : 'image',
      cloudinary_public_id: upload.public_id || null,
      original_filename: upload.original_filename || null,
      width: upload.width || null,
      height: upload.height || null,
      duration_seconds: upload.duration || null,
      alt_ua: title,
      alt_en: title,
      archived: false,
      public_visible: true
    };
    const { data, error } = await client.from('media_assets').upsert(payload, { onConflict: 'source_url' }).select().single();
    if (error) throw error;
    return data;
  }
  const assetMap = () => new Map(state.assets.map(item => [item.id, item]));
  const showToast = (message, error = false) => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast show${error ? ' error' : ''}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.className = 'toast', 2800);
  };
  const setStatus = (message) => { $('#status-line').textContent = message; };
  const refreshIcons = () => window.lucide?.createIcons();

  async function ensureAdmin(user) {
    const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error || !data) throw new Error('Цей акаунт не має доступу до панелі керування.');
  }

  async function showAdmin(user) {
    await ensureAdmin(user);
    $('#login-view').hidden = true;
    $('#admin-view').hidden = false;
    await loadData();
  }

  async function loadData() {
    setStatus('Завантаження даних...');
    const [projects, assets, projectMedia, gallery] = await Promise.all([
      client.from('projects').select('*').order('sort_order'),
      client.from('media_assets').select('*').order('created_at', { ascending: false }),
      client.from('project_media').select('*').order('sort_order'),
      client.from('gallery_items').select('*').order('sort_order')
    ]);
    const failure = [projects, assets, projectMedia, gallery].find(result => result.error);
    if (failure) throw failure.error;
    state.projects = projects.data || [];
    state.assets = assets.data || [];
    state.projectMedia = projectMedia.data || [];
    state.gallery = gallery.data || [];
    updateSummary();
    render();
  }

  function updateSummary() {
    $('#count-projects').textContent = state.projects.length;
    $('#count-static').textContent = state.gallery.filter(x => x.gallery_type === 'static').length;
    $('#count-video').textContent = state.gallery.filter(x => x.gallery_type === 'video').length;
    $('#count-media').textContent = state.assets.length;
  }

  function filtered(items, getText) {
    const query = state.query.trim().toLocaleLowerCase();
    return query ? items.filter(item => getText(item).toLocaleLowerCase().includes(query)) : items;
  }

  function render() {
    $('#view-title').textContent = titles[state.view];
    $('#add-btn').hidden = state.view === 'media';
    $('#add-btn span').textContent = state.view === 'projects' ? 'Новий проєкт' : 'Додати';
    if (state.view === 'projects') renderProjects();
    else if (state.view === 'media') renderMedia();
    else renderGallery(state.view);
    refreshIcons();
  }

  function renderProjects() {
    const assets = assetMap();
    const items = filtered(state.projects, item => `${item.name_ua} ${item.name_en} ${item.description_ua}`);
    setStatus(`${items.length} із ${state.projects.length} проєктів`);
    $('#content').innerHTML = items.length ? `<div class="data-list">${items.map(project => {
      const cover = assets.get(project.cover_asset_id);
      const mediaCount = state.projectMedia.filter(item => item.project_id === project.id).length;
      return `<article class="data-row" data-id="${project.id}">
        <img class="thumb" src="${escapeHtml(posterFor(cover))}" alt="">
        <div class="row-main"><strong>${escapeHtml(project.name_ua)}</strong><small>${mediaCount} матеріалів · ${escapeHtml(project.id)}</small></div>
        <span class="badge ${project.published ? 'live' : ''}">${project.published ? 'Опубліковано' : 'Приховано'}</span>
        <span class="badge hide-tablet">${project.featured ? featuredLabels.projects : 'Повний список'}</span>
        <div class="row-actions">
          <button data-action="move-up" title="Вище"><i data-lucide="arrow-up"></i></button>
          <button data-action="move-down" title="Нижче"><i data-lucide="arrow-down"></i></button>
          <button data-action="edit-project" title="Редагувати"><i data-lucide="pencil"></i></button>
        </div>
      </article>`;
    }).join('')}</div>` : emptyState('Проєкти не знайдено');
  }

  function renderGallery(type) {
    const assets = assetMap();
    const all = state.gallery.filter(item => item.gallery_type === type).sort((a, b) => a.sort_order - b.sort_order);
    const items = filtered(all, item => `${item.title_ua} ${item.title_en} ${(item.categories || []).join(' ')}`);
    setStatus(`${items.length} із ${all.length} робіт · зірочкою позначені роботи на головній`);
    $('#content').innerHTML = items.length ? `<div class="media-grid">${items.map(item => {
      const asset = assets.get(item.asset_id);
      return `<article class="media-card ${item.published ? '' : 'is-hidden'}" data-id="${item.id}">
        <div class="media-preview"><img src="${escapeHtml(posterFor(asset))}" alt="" loading="lazy"></div>
        <div class="media-body">
          <strong>${escapeHtml(item.title_ua || fileName(asset?.source_url))}</strong>
          <div class="media-meta"><span class="badge ${item.published ? 'live' : ''}">${item.published ? 'Видима' : 'Прихована'}</span>${item.featured ? '<span class="badge live">Головна</span>' : ''}</div>
          <div class="media-actions">
            <button data-action="move-up" title="Вище"><i data-lucide="arrow-up"></i></button>
            <button data-action="move-down" title="Нижче"><i data-lucide="arrow-down"></i></button>
            <button class="icon-only" data-action="edit-gallery" title="Редагувати"><i data-lucide="pencil"></i></button>
            <button class="icon-only" data-action="remove-gallery" title="Прибрати з розділу"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>` : emptyState('У цьому розділі поки немає робіт');
  }

  function renderMedia() {
    const usage = new Map();
    for (const item of state.projectMedia) usage.set(item.asset_id, (usage.get(item.asset_id) || 0) + 1);
    for (const item of state.gallery) usage.set(item.asset_id, (usage.get(item.asset_id) || 0) + 1);
    for (const project of state.projects) if (project.cover_asset_id) usage.set(project.cover_asset_id, (usage.get(project.cover_asset_id) || 0) + 1);
    const items = filtered(state.assets, item => `${fileName(item.source_url)} ${item.alt_ua} ${item.media_type}`);
    setStatus(`${items.length} унікальних файлів · архівування не видаляє файл із Cloudinary`);
    $('#content').innerHTML = items.length ? `<div class="data-list">${items.map(asset => `<article class="data-row" data-id="${asset.id}">
      <img class="thumb" src="${escapeHtml(posterFor(asset))}" alt="" loading="lazy">
      <div class="row-main"><strong>${escapeHtml(fileName(asset.source_url))}</strong><small>${escapeHtml(asset.alt_ua || 'Без опису')}</small></div>
      <span class="badge ${asset.archived ? '' : 'live'}">${asset.media_type}</span>
      <span class="badge hide-mobile">${usage.get(asset.id) || 0} розміщень</span>
      <div class="row-actions"><button data-action="toggle-archive" title="${asset.archived ? 'Повернути з архіву' : 'Архівувати'}"><i data-lucide="${asset.archived ? 'archive-restore' : 'archive'}"></i></button></div>
    </article>`).join('')}</div>` : emptyState('Файли не знайдено');
  }

  const emptyState = (message) => `<div class="empty-state">${escapeHtml(message)}</div>`;

  const projectSlug = (value) => {
    const base = String(value || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `project-${Date.now()}`;
    let slug = base;
    let suffix = 2;
    while (state.projects.some(project => project.id === slug)) slug = `${base}-${suffix++}`;
    return slug;
  };

  const sectionOptions = (item, asset) => {
    const sections = asset?.media_type === 'video'
      ? [['video', 'Відео']]
      : [['before', 'До'], ['process', 'Процес'], ['works', 'Роботи']];
    return sections.map(([value, label]) => `<option value="${value}" ${item.section === value ? 'selected' : ''}>${label}</option>`).join('');
  };

  function projectMediaEditor(project) {
    const assets = assetMap();
    const items = state.projectMedia
      .filter(item => item.project_id === project.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (!items.length) return '<div class="project-media-empty">У проєкті поки немає матеріалів.</div>';
    return `<fieldset class="project-media-field">
      <legend>Матеріали проєкту <small>${items.length}</small></legend>
      <div class="project-media-list">${items.map(item => {
        const asset = assets.get(item.asset_id);
        const isImage = asset?.media_type === 'image';
        return `<article class="project-media-item" data-project-media-id="${item.id}" data-asset-id="${item.asset_id}" data-removed="false">
          <img src="${escapeHtml(posterFor(asset))}" alt="" loading="lazy">
          <div class="project-media-fields">
            <label>Розділ<select data-field="section">${sectionOptions(item, asset)}</select></label>
            <label>Назва українською<input data-field="title_ua" value="${escapeHtml(item.title_ua)}"></label>
            <label>Назва англійською<input data-field="title_en" value="${escapeHtml(item.title_en)}"></label>
            <label>Підпис українською<textarea data-field="caption_ua">${escapeHtml(item.caption_ua)}</textarea></label>
            <label>Підпис англійською<textarea data-field="caption_en">${escapeHtml(item.caption_en)}</textarea></label>
          </div>
          <div class="project-media-actions">
            <button type="button" data-project-media-action="up" title="Вище"><i data-lucide="arrow-up"></i></button>
            <button type="button" data-project-media-action="down" title="Нижче"><i data-lucide="arrow-down"></i></button>
            ${isImage ? '<button type="button" data-project-media-action="cover" title="Зробити обкладинкою"><i data-lucide="image"></i></button>' : ''}
            <button class="danger" type="button" data-project-media-action="remove" title="Прибрати з проєкту"><i data-lucide="trash-2"></i></button>
          </div>
        </article>`;
      }).join('')}</div>
      <small class="project-media-help">Зміни порядку, розділів і підписів застосуються після збереження проєкту.</small>
    </fieldset>`;
  }

  function projectFields(project = null) {
    const imageAssets = state.assets.filter(asset => asset.media_type === 'image' && !asset.archived);
    const coverOptions = imageAssets.map(asset => `<option value="${asset.id}" ${asset.id === project?.cover_asset_id ? 'selected' : ''}>${escapeHtml(fileName(asset.source_url))}</option>`).join('');
    return `
      <input type="hidden" name="kind" value="project"><input type="hidden" name="id" value="${escapeHtml(project?.id || '')}">
      <label>Назва українською<input name="name_ua" required value="${escapeHtml(project?.name_ua || '')}"></label>
      <label>Назва англійською<input name="name_en" required value="${escapeHtml(project?.name_en || '')}"></label>
      <label>Опис українською<textarea name="description_ua">${escapeHtml(project?.description_ua || '')}</textarea></label>
      <label>Опис англійською<textarea name="description_en">${escapeHtml(project?.description_en || '')}</textarea></label>
      <label>Обкладинка з медіатеки <small>лише фото</small><select name="cover_asset_id"><option value="">Не обрано</option>${coverOptions}</select></label>
      <label>Або завантажити нову обкладинку <small>лише фото</small><input name="cover_file" type="file" accept="image/*"><small>Обкладинка автоматично потрапить у Cloudinary і медіатеку.</small></label>
      <label>Додати фото та відео до проєкту<input name="project_files" type="file" accept="image/*,video/*" multiple><small>Можна вибрати одразу кілька файлів. Фото потраплять у роботи, відео — у відеорозділ проєкту.</small></label>
      <div class="check-row project-gallery-options">
        <label><input name="also_static" type="checkbox"> Також додати фото в AI Static Creatives</label>
        <label><input name="also_video" type="checkbox"> Також додати відео в AI Video</label>
      </div>
      <div class="check-row"><label><input name="published" type="checkbox" ${project?.published !== false ? 'checked' : ''}> Опубліковано</label><label><input name="featured" type="checkbox" ${project?.featured ? 'checked' : ''}> На головній</label></div>
      ${project ? projectMediaEditor(project) : ''}`;
  }

  function openNewProjectEditor() {
    $('#dialog-title').textContent = 'Новий проєкт';
    $('#edit-fields').innerHTML = projectFields();
    $('#save-edit').textContent = 'Створити проєкт';
    $('#edit-dialog').showModal();
    refreshIcons();
  }

  function openProjectEditor(project) {
    $('#dialog-title').textContent = project.name_ua;
    $('#edit-fields').innerHTML = projectFields(project);
    $('#save-edit').textContent = 'Зберегти';
    $('#edit-dialog').showModal();
    refreshIcons();
  }

  function openGalleryEditor(item) {
    $('#dialog-title').textContent = item.title_ua || titles[item.gallery_type];
    $('#edit-fields').innerHTML = `
      <input type="hidden" name="kind" value="gallery"><input type="hidden" name="id" value="${item.id}">
      <label>Назва українською<input name="title_ua" value="${escapeHtml(item.title_ua)}"></label>
      <label>Назва англійською<input name="title_en" value="${escapeHtml(item.title_en)}"></label>
      <label>Підпис українською<textarea name="caption_ua">${escapeHtml(item.caption_ua)}</textarea></label>
      <label>Підпис англійською<textarea name="caption_en">${escapeHtml(item.caption_en)}</textarea></label>
      <fieldset class="category-field"><legend>Категорії</legend><div class="category-options">${categoryOptions(item.gallery_type, item.categories || [])}</div></fieldset>
      <div class="check-row"><label><input name="published" type="checkbox" ${item.published ? 'checked' : ''}> Видима</label><label><input name="featured" type="checkbox" ${item.featured ? 'checked' : ''}> На головній</label></div>`;
    $('#edit-dialog').showModal();
    refreshIcons();
  }

  async function addFilesToProject(projectId, files, projectName, galleryOptions) {
    const addedPerSection = { works: 0, video: 0 };
    const addedToGallery = { static: 0, video: 0 };
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error(`Файл ${file.name} не є зображенням або відео.`);
      }
      const upload = await uploadToCloudinary(file, percent => {
        $('#save-edit').textContent = `Файл ${index + 1}/${files.length}: ${percent}%`;
      });
      const asset = await saveUploadedAsset(upload, `${projectName} — ${file.name}`);
      const section = asset.media_type === 'video' ? 'video' : 'works';
      const existingOrders = state.projectMedia
        .filter(item => item.project_id === projectId && item.section === section)
        .map(item => item.sort_order);
      const sortOrder = Math.max(-1, ...existingOrders) + 1 + addedPerSection[section];
      addedPerSection[section] += 1;
      const title = file.name.replace(/\.[^.]+$/, '');
      const { error } = await client.from('project_media').upsert({
        project_id: projectId,
        asset_id: asset.id,
        section,
        title_ua: title,
        title_en: title,
        sort_order: sortOrder,
        published: true
      }, { onConflict: 'project_id,asset_id,section' });
      if (error) throw error;

      const galleryType = asset.media_type === 'video' ? 'video' : 'static';
      const addToGallery = galleryType === 'video' ? galleryOptions.video : galleryOptions.static;
      const alreadyPlaced = state.gallery.some(item => item.asset_id === asset.id && item.gallery_type === galleryType);
      if (addToGallery && !alreadyPlaced) {
        const existingOrders = state.gallery
          .filter(item => item.gallery_type === galleryType)
          .map(item => item.sort_order);
        const galleryOrder = Math.max(-1, ...existingOrders) + 1 + addedToGallery[galleryType];
        addedToGallery[galleryType] += 1;
        const { error: galleryError } = await client.from('gallery_items').insert({
          asset_id: asset.id,
          gallery_type: galleryType,
          title_ua: title,
          title_en: title,
          categories: [],
          sort_order: galleryOrder,
          published: true,
          featured: false
        });
        if (galleryError) throw galleryError;
      }
    }
  }

  async function saveProjectMediaChanges() {
    const rows = [...document.querySelectorAll('.project-media-item')];
    const removedIds = rows
      .filter(row => row.dataset.removed === 'true')
      .map(row => row.dataset.projectMediaId);
    if (removedIds.length) {
      const { error } = await client.from('project_media').delete().in('id', removedIds);
      if (error) throw error;
    }
    const sectionOrders = { before: 0, process: 0, works: 0, video: 0 };
    const updates = rows.filter(row => row.dataset.removed !== 'true').map(row => {
      const section = row.querySelector('[data-field="section"]').value;
      const payload = {
        section,
        title_ua: row.querySelector('[data-field="title_ua"]').value.trim(),
        title_en: row.querySelector('[data-field="title_en"]').value.trim(),
        caption_ua: row.querySelector('[data-field="caption_ua"]').value.trim(),
        caption_en: row.querySelector('[data-field="caption_en"]').value.trim(),
        sort_order: sectionOrders[section]++
      };
      return client.from('project_media').update(payload).eq('id', row.dataset.projectMediaId);
    });
    const results = await Promise.all(updates);
    const failed = results.find(result => result.error);
    if (failed) throw failed.error;
  }

  async function saveEdit(formData) {
    const kind = formData.get('kind');
    const id = formData.get('id');
    if (kind === 'project') {
      let coverAssetId = formData.get('cover_asset_id');
      const coverFile = formData.get('cover_file');
      if (coverFile?.size) {
        const upload = await uploadToCloudinary(coverFile, percent => { $('#save-edit').textContent = `Завантаження ${percent}%`; });
        const uploadedAsset = await saveUploadedAsset(upload, `${formData.get('name_ua').trim()} cover`);
        coverAssetId = uploadedAsset.id;
      }
      const payload = {
        name_ua: formData.get('name_ua').trim(), name_en: formData.get('name_en').trim(),
        description_ua: formData.get('description_ua').trim(), description_en: formData.get('description_en').trim(),
        cover_asset_id: coverAssetId, published: formData.has('published'), featured: formData.has('featured')
      };
      if (!coverAssetId) throw new Error('Оберіть або завантажте обкладинку проєкту.');
      let request;
      let projectId = id;
      if (id) {
        request = client.from('projects').update(payload).eq('id', id);
      } else {
        const maxOrder = Math.max(-1, ...state.projects.map(project => project.sort_order));
        projectId = projectSlug(payload.name_en);
        request = client.from('projects').insert({
          id: projectId,
          ...payload,
          sort_order: maxOrder + 1
        });
      }
      const { error } = await request;
      if (error) throw error;
      if (id) await saveProjectMediaChanges();
      const projectFiles = formData.getAll('project_files').filter(file => file?.size);
      if (projectFiles.length) {
        await addFilesToProject(projectId, projectFiles, payload.name_ua, {
          static: formData.has('also_static'),
          video: formData.has('also_video')
        });
      }
    } else {
      const payload = {
        title_ua: formData.get('title_ua').trim(), title_en: formData.get('title_en').trim(),
        caption_ua: formData.get('caption_ua').trim(), caption_en: formData.get('caption_en').trim(),
        categories: formData.getAll('categories'),
        published: formData.has('published'), featured: formData.has('featured')
      };
      const { error } = await client.from('gallery_items').update(payload).eq('id', id);
      if (error) throw error;
    }
    showToast('Зміни збережено');
    await loadData();
  }

  async function moveItem(id, direction) {
    const list = state.view === 'projects'
      ? [...state.projects].sort((a, b) => a.sort_order - b.sort_order)
      : state.gallery.filter(x => x.gallery_type === state.view).sort((a, b) => a.sort_order - b.sort_order);
    const index = list.findIndex(item => item.id === id);
    const otherIndex = index + direction;
    if (index < 0 || otherIndex < 0 || otherIndex >= list.length) return;
    const current = list[index], other = list[otherIndex];
    const table = state.view === 'projects' ? 'projects' : 'gallery_items';
    const [one, two] = await Promise.all([
      client.from(table).update({ sort_order: other.sort_order }).eq('id', current.id),
      client.from(table).update({ sort_order: current.sort_order }).eq('id', other.id)
    ]);
    if (one.error || two.error) throw one.error || two.error;
    await loadData();
  }

  async function removeGallery(id) {
    if (!confirm('Прибрати роботу з цього розділу? Сам файл залишиться у медіатеці та Cloudinary.')) return;
    const { error } = await client.from('gallery_items').delete().eq('id', id);
    if (error) throw error;
    showToast('Роботу прибрано з розділу');
    await loadData();
  }

  async function toggleArchive(id) {
    const asset = state.assets.find(item => item.id === id);
    const { error } = await client.from('media_assets').update({ archived: !asset.archived, public_visible: asset.archived }).eq('id', id);
    if (error) throw error;
    showToast(asset.archived ? 'Файл повернено з архіву' : 'Файл архівовано');
    await loadData();
  }

  async function addWork(form) {
    const type = $('#add-type').value;
    let url = $('#add-url').value.trim();
    const file = $('#add-file').files[0];
    const title = $('#add-title').value.trim();
    const categories = new FormData(form).getAll('categories');
    if (!file && !url) throw new Error('Оберіть файл з комп\'ютера або вставте готове посилання.');
    let asset;
    if (file) {
      const expectedType = type === 'video' ? 'video/' : 'image/';
      if (!file.type.startsWith(expectedType)) throw new Error(type === 'video' ? 'Для розділу Video оберіть відеофайл.' : 'Для розділу Static оберіть зображення.');
      const upload = await uploadToCloudinary(file, percent => { $('#upload-status').textContent = `Завантаження у Cloudinary: ${percent}%`; });
      asset = await saveUploadedAsset(upload, title);
      url = upload.secure_url;
    } else {
      const mediaType = type === 'video' ? 'video' : 'image';
      const result = await client.from('media_assets')
        .upsert({ source_url: url, media_type: mediaType, alt_ua: title, alt_en: title, archived: false, public_visible: true }, { onConflict: 'source_url' })
        .select().single();
      if (result.error) throw result.error;
      asset = result.data;
    }
    const maxOrder = Math.max(-1, ...state.gallery.filter(x => x.gallery_type === type).map(x => x.sort_order));
    const { error } = await client.from('gallery_items').upsert({
      asset_id: asset.id, gallery_type: type, title_ua: title, title_en: title,
      categories, sort_order: maxOrder + 1, published: true, featured: false
    }, { onConflict: 'asset_id,gallery_type' });
    if (error) throw error;
    form.reset();
    $('#upload-status').textContent = 'Оберіть файл або вставте вже готове посилання. Повторний файл не дублюється.';
    $('#add-dialog').close();
    showToast('Роботу додано');
    await loadData();
  }

  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('#login-error').textContent = '';
    const button = event.submitter;
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Вхід...';
    try {
      const request = client.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Сервер не відповідає. Перевірте інтернет і спробуйте ще раз.')), 15000));
      const { data, error } = await Promise.race([request, timeout]);
      if (error) throw error;
      await showAdmin(data.user);
    } catch (error) {
      $('#login-error').textContent = error.message === 'Invalid login credentials' ? 'Невірний email або пароль.' : error.message;
    } finally { button.disabled = false; button.textContent = originalLabel; }
  });

  $('#logout-btn').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });
  $('#admin-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    state.view = button.dataset.view;
    state.query = '';
    $('#search-input').value = '';
    document.querySelectorAll('.nav-btn').forEach(item => item.classList.toggle('active', item === button));
    render();
  });
  $('#search-input').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('#add-btn').addEventListener('click', () => {
    if (state.view === 'projects') {
      openNewProjectEditor();
      return;
    }
    $('#add-type').value = state.view;
    $('#add-category-options').innerHTML = categoryOptions(state.view);
    $('#add-dialog').showModal();
    refreshIcons();
  });
  $('#add-type').addEventListener('change', event => { $('#add-category-options').innerHTML = categoryOptions(event.target.value); });
  document.addEventListener('click', event => {
    const closeButton = event.target.closest('[data-close-dialog]');
    if (closeButton) closeButton.closest('dialog')?.close();
  });

  $('#edit-fields').addEventListener('click', event => {
    const button = event.target.closest('[data-project-media-action]');
    if (!button) return;
    const row = button.closest('.project-media-item');
    const list = row.closest('.project-media-list');
    const activeRows = [...list.querySelectorAll('.project-media-item')]
      .filter(item => item.dataset.removed !== 'true');
    const index = activeRows.indexOf(row);
    const action = button.dataset.projectMediaAction;
    if (action === 'up' && index > 0) list.insertBefore(row, activeRows[index - 1]);
    if (action === 'down' && index >= 0 && index < activeRows.length - 1) list.insertBefore(activeRows[index + 1], row);
    if (action === 'cover') {
      const coverSelect = $('#edit-fields [name="cover_asset_id"]');
      coverSelect.value = row.dataset.assetId;
      showToast('Обкладинку обрано. Натисніть «Зберегти».');
    }
    if (action === 'remove') {
      row.dataset.removed = 'true';
      row.hidden = true;
      showToast('Матеріал буде прибрано з проєкту після збереження');
    }
  });

  $('#content').addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.closest('[data-id]').dataset.id;
    try {
      if (button.dataset.action === 'edit-project') openProjectEditor(state.projects.find(item => item.id === id));
      if (button.dataset.action === 'edit-gallery') openGalleryEditor(state.gallery.find(item => item.id === id));
      if (button.dataset.action === 'move-up') await moveItem(id, -1);
      if (button.dataset.action === 'move-down') await moveItem(id, 1);
      if (button.dataset.action === 'remove-gallery') await removeGallery(id);
      if (button.dataset.action === 'toggle-archive') await toggleArchive(id);
    } catch (error) { showToast(error.message, true); }
  });

  $('#edit-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#save-edit');
    button.disabled = true;
    try { await saveEdit(new FormData(event.currentTarget)); $('#edit-dialog').close(); }
    catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; button.textContent = 'Зберегти'; }
  });
  $('#add-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try { await addWork(event.currentTarget); }
    catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; }
  });

  async function init() {
    refreshIcons();
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    try { await showAdmin(session.user); }
    catch (error) { await client.auth.signOut(); $('#login-error').textContent = error.message; }
  }
  init().catch(error => { $('#login-error').textContent = error.message; });
})();
