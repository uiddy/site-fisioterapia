// Fotos ampliáveis; as logos mantêm seus links para o início.
const imageViewer = document.getElementById('image-viewer');
const viewerPhoto = document.getElementById('image-viewer-photo');
const viewerCaption = document.getElementById('image-viewer-caption');
let imageTrigger;
let previousOverflow;

document.querySelectorAll('img').forEach(photo => {
    if (photo.closest('a, dialog')) return;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'image-zoom';
    trigger.setAttribute('aria-label', `Ampliar imagem: ${photo.alt}`);
    trigger.setAttribute('aria-haspopup', 'dialog');
    photo.before(trigger);
    trigger.append(photo);

    trigger.addEventListener('click', () => {
        if (typeof imageViewer.showModal !== 'function') {
            window.location.assign(photo.currentSrc || photo.src);
            return;
        }
        imageTrigger = trigger;
        viewerPhoto.src = photo.currentSrc || photo.src;
        viewerPhoto.alt = photo.alt;
        const caption = photo.closest('figure')?.querySelector('figcaption');
        viewerCaption.textContent = caption ? caption.textContent.trim() : '';
        viewerCaption.hidden = !viewerCaption.textContent;
        previousOverflow = document.body.style.overflow;
        imageViewer.showModal();
        document.body.style.overflow = 'hidden';
    });
});

const viewerCloseButton = imageViewer.querySelector('button');
viewerCloseButton.addEventListener('click', () => imageViewer.close());
imageViewer.addEventListener('keydown', event => {
    // O botão de fechar é o único controle interativo desta janela.
    if (event.key === 'Tab') {
        event.preventDefault();
        viewerCloseButton.focus();
    }
});
imageViewer.addEventListener('click', event => {
    if (event.target === imageViewer) imageViewer.close();
});
imageViewer.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    viewerPhoto.removeAttribute('src');
    imageTrigger?.focus();
});

// Lógica do Menu Mobile
const btn = document.getElementById('mobile-menu-btn');
const menu = document.getElementById('mobile-menu');

function setMenuOpen(open) {
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}

btn.addEventListener('click', () => {
    setMenuOpen(btn.getAttribute('aria-expanded') !== 'true');
});

// Fechar menu mobile ao clicar num link
document.querySelectorAll('#mobile-menu a').forEach(link => {
    link.addEventListener('click', () => {
        setMenuOpen(false);
    });
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        btn.focus();
    }
});

document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !btn.contains(event.target)) setMenuOpen(false);
});

window.matchMedia('(min-width: 1280px)').addEventListener('change', () => setMenuOpen(false));

// Efeito visual no cabeçalho ao rolar a página
function updateHeader() {
    const header = document.getElementById('navbar');
    if (window.scrollY > 20) {
        header.classList.add('nav-scrolled');
        header.classList.remove('py-3');
    } else {
        header.classList.remove('nav-scrolled');
        header.classList.add('py-3');
    }
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
