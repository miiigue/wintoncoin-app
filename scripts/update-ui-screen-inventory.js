const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const docsDir = path.join(rootDir, 'docs');
const outputPath = path.join(docsDir, 'UI_SCREEN_INVENTORY.md');

const versionedJsRegex = /<script[^>]*src="([^"]+\.v\d+\.\d+\.\d+\.js)"[^>]*>/gi;
const modalRegex = /<div[^>]*id="([^"]+)"[^>]*class="([^"]+)"[^>]*>/gi;

const excludedScripts = new Set(['utils.v1.4.1.js', 'password-toggle.v1.4.1.js']);

const displayNameMap = new Map([
    ['index.html', 'Login'],
    ['register.html', 'Registro'],
    ['contract_interaction.html', 'Panel principal / Interaccion'],
    ['profile.html', 'Perfil de usuario'],
    ['history.html', 'Historial'],
    ['transactions.html', 'Transacciones'],
    ['referrals.html', 'Referidos'],
    ['publish.html', 'Publicar'],
    ['publication-detail.html', 'Detalle de publicacion'],
    ['booster-profile.html', 'Perfil de Impulsor'],
    ['p2p.html', 'P2P principal'],
    ['p2p-history.html', 'P2P historial'],
    ['admin.html', 'Admin login'],
    ['admin-panel.html', 'Admin panel'],
    ['love.html', 'Love'],
    ['como-funciona.html', 'Como funciona'],
    ['terms.html', 'Terminos'],
    ['privacy.html', 'Privacidad']
]);

const categoryOrder = [
    {
        name: 'Autenticacion y onboarding',
        files: ['index.html', 'register.html']
    },
    {
        name: 'Core (usuario)',
        files: [
            'contract_interaction.html',
            'profile.html',
            'history.html',
            'transactions.html',
            'referrals.html',
            'publish.html',
            'publication-detail.html',
            'booster-profile.html'
        ]
    },
    {
        name: 'P2P',
        files: ['p2p.html', 'p2p-history.html']
    },
    {
        name: 'Admin',
        files: ['admin.html', 'admin-panel.html']
    },
    {
        name: 'Otras pantallas',
        files: []
    }
];

function titleFromFilename(filename) {
    if (displayNameMap.has(filename)) {
        return displayNameMap.get(filename);
    }

    const base = filename.replace('.html', '').replace(/-/g, ' ');
    return base
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function extractScripts(htmlContent) {
    const scripts = [];
    let match;
    while ((match = versionedJsRegex.exec(htmlContent)) !== null) {
        const scriptPath = match[1];
        const scriptFile = path.basename(scriptPath);
        scripts.push(scriptFile);
    }
    return scripts;
}

function extractModals(htmlContent) {
    const modals = new Set();
    let match;
    while ((match = modalRegex.exec(htmlContent)) !== null) {
        const modalId = match[1];
        const classList = match[2].split(/\s+/);
        if (classList.includes('modal')) {
            modals.add(modalId);
        }
    }
    return Array.from(modals).sort();
}

function selectPrimaryScript(scripts) {
    const filtered = scripts.filter(script => !excludedScripts.has(script));
    return filtered.length ? filtered[0] : null;
}

function getHtmlFiles() {
    return fs
        .readdirSync(frontendDir)
        .filter(file => file.endsWith('.html'))
        .sort();
}

function buildEntries() {
    const htmlFiles = getHtmlFiles();
    const entries = [];
    const staticScreens = [];

    htmlFiles.forEach(file => {
        const filePath = path.join(frontendDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const scripts = extractScripts(content);
        const modals = extractModals(content);
        const primaryScript = selectPrimaryScript(scripts);

        if (!primaryScript) {
            staticScreens.push({
                name: titleFromFilename(file),
                html: `frontend/${file}`
            });
            return;
        }

        entries.push({
            name: titleFromFilename(file),
            html: `frontend/${file}`,
            js: `frontend/${primaryScript}`,
            modals
        });
    });

    return { entries, staticScreens };
}

function groupEntries(entries) {
    const grouped = new Map();

    categoryOrder.forEach(category => {
        grouped.set(category.name, []);
    });

    const fileToCategory = new Map();
    categoryOrder.forEach(category => {
        category.files.forEach(file => {
            fileToCategory.set(`frontend/${file}`, category.name);
        });
    });

    entries.forEach(entry => {
        const category = fileToCategory.get(entry.html) || 'Otras pantallas';
        grouped.get(category).push(entry);
    });

    return grouped;
}

function formatModalList(modals) {
    if (!modals || modals.length === 0) {
        return '(sin modales)';
    }
    return modals.map(modal => `\`${modal}\``).join(', ');
}

function formatTableRows(entries, includeSubscreens) {
    return entries.map(entry => {
        const modals = formatModalList(entry.modals);
        const baseRow = `| ${entry.name} | \`${entry.html}\` | \`${entry.js}\` | ${modals}`;
        if (!includeSubscreens) {
            return `${baseRow} |`;
        }

        let subscreens = '(sin subpantallas)';
        if (entry.html === 'frontend/p2p.html') {
            subscreens = '`frontend/p2p-history.html`';
        }
        return `${baseRow} | ${subscreens} |`;
    });
}

function buildMarkdown({ entries, staticScreens }) {
    const grouped = groupEntries(entries);

    const lines = [
        '# UI Screen Inventory (Frontend)',
        '',
        'Objetivo: tener una vista unica y jerarquica de todas las pantallas UI, sus assets JS y sus modales/subventanas.',
        'Regla: cada vez que se cree una pantalla nueva o se agregue un modal, actualizar este archivo.',
        '',
        '## 1) Autenticacion y onboarding',
        ''
    ];

    const sectionOrder = [
        'Autenticacion y onboarding',
        'Core (usuario)',
        'P2P',
        'Admin',
        'Otras pantallas'
    ];

    sectionOrder.forEach((section, index) => {
        if (index !== 0) {
            lines.push(`## ${index + 1}) ${section}`);
            lines.push('');
        }

        const sectionEntries = grouped.get(section) || [];
        sectionEntries.forEach(entry => {
            lines.push(`- ${entry.name}`);
            lines.push(`  - HTML: \`${entry.html}\``);
            lines.push(`  - JS: \`${entry.js}\``);
            lines.push(`  - Modales: ${formatModalList(entry.modals)}`);
        });

        lines.push('');
        lines.push(`### Tabla - ${section}`);
        lines.push('');

        if (section === 'P2P') {
            lines.push('| Pantalla | HTML | JS | Modales | Subpantallas |');
            lines.push('| --- | --- | --- | --- | --- |');
            lines.push(...formatTableRows(sectionEntries, true));
        } else {
            lines.push('| Pantalla | HTML | JS | Modales |');
            lines.push('| --- | --- | --- | --- |');
            lines.push(...formatTableRows(sectionEntries, false));
        }

        lines.push('');
    });

    lines.push('## 6) Pantallas estaticas (sin JS)');
    lines.push('');
    if (staticScreens.length === 0) {
        lines.push('- (sin pantallas estaticas)');
    } else {
        staticScreens.forEach(screen => {
            lines.push(`- ${screen.name}`);
            lines.push(`  - HTML: \`${screen.html}\``);
        });
    }
    lines.push('');

    lines.push('## 7) Core utilities');
    lines.push('');
    lines.push('- Utilidades globales');
    lines.push('  - JS: `frontend/utils.v1.4.1.js`');
    lines.push('  - Modales: `customAlertModal`, `customConfirmModal` (usados por varias pantallas)');
    lines.push('');
    lines.push('### Tabla - Core utilities');
    lines.push('');
    lines.push('| Item | JS | Modales |');
    lines.push('| --- | --- | --- |');
    lines.push('| Utilidades globales | `frontend/utils.v1.4.1.js` | `customAlertModal`, `customConfirmModal` |');
    lines.push('');

    return lines.join('\n');
}

function ensureDocsDir() {
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }
}

function main() {
    const result = buildEntries();
    const markdown = buildMarkdown(result);
    ensureDocsDir();
    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log('UI screen inventory actualizado.');
}

main();
