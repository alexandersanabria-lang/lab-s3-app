const API = 'http://localhost:3000';
const MAX_SIZE_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const file = document.getElementById('file').files[0];
  if (!file) return alert('Selecciona un archivo');
  if (!ALLOWED.includes(file.type)) return alert('Tipo no permitido');
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return alert('Archivo demasiado grande');

  const res = await fetch(`${API}/api/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Error');

  const put = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });
  if (!put.ok) return alert('Error al subir a S3: ' + put.status);

  document.getElementById('status').textContent = 'Subida completa';
  loadGallery();
});

async function loadGallery() {
  const res = await fetch(`${API}/api/images`);
  const items = await res.json();
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = items.map(i =>
    `<div class="card">
       <img src="${i.url}" alt="">
       <button onclick="del('${i.key}')">Eliminar</button>
     </div>`
  ).join('');
}

async function del(key) {
  if (!confirm('Eliminar?')) return;
  await fetch(`${API}/api/images/${encodeURIComponent(key)}`, { method: 'DELETE' });
  loadGallery();
}

loadGallery();
