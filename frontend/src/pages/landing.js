import '../../landing.css';
import '../../landing-fomo.css';

// Script para la Landing Page
console.log('[Landing] Styles loaded via JS entry point');

import { initMigrationCheck } from '../modules/migrationManager.js';

initMigrationCheck();

// Animaciones de Scroll (Migrado del inline script)
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.step-card, .trust-content, .token-card, .community-visual-section').forEach(el => {
        el.classList.add('fade-in-section');
        observer.observe(el);
    });

    // Efecto Parallax en Mouse (Hero Visual)
    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.card-float');
        const floatingImg = document.querySelector('.floating-img');

        const x = (window.innerWidth - e.pageX * 2) / 100;
        const y = (window.innerHeight - e.pageY * 2) / 100;

        cards.forEach(card => {
            card.style.transform = `translateX(${x}px) translateY(${y}px)`;
        });

        if (floatingImg) {
            floatingImg.style.transform = `translateX(${-x * 0.5}px) translateY(${-y * 0.5}px)`;
        }
    });
});
