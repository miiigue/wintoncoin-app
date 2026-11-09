'use strict';

const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'admin-panel.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const builtPath = path.resolve(__dirname, '..', 'dist-demo', 'admin-panel.html');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(
    /<a\s+id="sidebarCrmLink"\s+class="nav-link"\s+aria-disabled="true">/i.test(source),
    'El enlace CRM debe nacer sin href ni target.'
);
assert(
    source.includes("document.documentElement.dataset.wintonEnvironment === 'demo'")
        && source.includes("demoHosts.has(window.location.hostname.toLowerCase())"),
    'El panel debe reconocer Demo por marca de build y host permitido.'
);
assert(
    source.includes("link.href = 'https://www.crm.wintoncoin.com'")
        && source.includes("link.rel = 'noopener noreferrer'"),
    'Fuera de Demo debe conservarse el acceso CRM protegido.'
);

if (fs.existsSync(builtPath)) {
    const built = fs.readFileSync(builtPath, 'utf8');
    assert(built.includes('data-winton-environment="demo"'), 'El artefacto debe estar marcado como Demo.');
    assert(
        !/https:\/\/www\.crm\.wintoncoin\.com/i.test(built),
        'El artefacto Demo no puede contener la dirección del CRM productivo.'
    );
    assert(built.includes('CRM no disponible en Demo'), 'El panel Demo debe explicar que el CRM no está disponible.');
}

console.log('Aislamiento CRM de Demo verificado.');
