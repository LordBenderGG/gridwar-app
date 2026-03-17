#!/bin/bash
# GitHub Actions setup for GRIDWAR landing page

# Create directory structure
mkdir -p .github/workflows
mkdir -p assets
mkdir -p css
mkdir -p js

# Create GitHub Actions workflow for automatic deployment
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy Landing Page

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout
      uses: actions/checkout@v3
    
    - name: Setup Pages
      uses: actions/configure-pages@v3
    
    - name: Upload artifact
      uses: actions/upload-pages-artifact@v2
      with:
        path: '.'
    
    - name: Deploy to GitHub Pages
      uses: actions/deploy-pages@v3
EOF

# Create basic HTML structure
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GRIDWAR - El Juego de Tres en Raya Más Intenso</title>
    <meta name="description" content="Tres en raya en tiempo real con comodines, rangos y torneos. ¡Sin piedad!">
    <link rel="stylesheet" href="css/style.css">
    <link rel="icon" href="assets/icon.png" type="image/png">
</head>
<body>
    <!-- Header -->
    <header class="header">
        <div class="container">
            <h1>GRIDWAR</h1>
            <p class="tagline">El juego de Tres en Raya más intenso jamás creado</p>
        </div>
    </header>

    <!-- Features -->
    <section class="features">
        <div class="container">
            <h2>Características principales</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <h3>⚡ Multijugador en Tiempo Real</h3>
                    <p>Desafía a jugadores reales en partidas al mejor de 3. 30 segundos por turno. Sin bots. Sin esperas.</p>
                </div>
                <div class="feature-card">
                    <h3>🎯 8 Comodines Poderosos</h3>
                    <p>Congela, teletransporta, protege con escudo, causa terremotos y más para darle la vuelta al juego.</p>
                </div>
                <div class="feature-card">
                    <h3>🏆 Sistema de 7 Rangos</h3>
                    <p>Desde Novato hasta Leyenda. Tu rango es visible para todos los jugadores.</p>
                </div>
                <div class="feature-card">
                    <h3>💀 Salón de la Fama y la Vergüenza</h3>
                    <p>Los mejores ganan gloria. Los peores perdedores aparecen públicamente. Todos pueden verte.</p>
                </div>
                <div class="feature-card">
                    <h3>🏅 Torneos Eliminación</h3>
                    <p>Crea o únete a torneos de hasta 16 jugadores. Compite por gemas y derechos de presumir eternamente.</p>
                </div>
                <div class="feature-card">
                    <h3>📅 Misiones Diarias</h3>
                    <p>Completa desafíos diarios para ganar gemas y desbloquear logros.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- How it works -->
    <section class="how-it-works">
        <div class="container">
            <h2>¿Cómo jugar?</h2>
            <div class="steps">
                <div class="step">
                    <div class="step-number">1</div>
                    <h3>Regístrate o inicia sesión</h3>
                    <p>Crear tu cuenta es rápido y gratuito. Elige tu nombre de usuario y avatar.</p>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <h3>Encuentra un rival</h3>
                    <p>Juega contra cualquiera en el mundo o solo contra jugadores en tu red WiFi local.</p>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <h3>¡Gana y avanza!</h3>
                    <p>Victoria significa puntos, rangos más altos y recompensas en gemas.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Screenshots -->
    <section class="screenshots">
        <div class="container">
            <h2>Vista previa del juego</h2>
            <div class="screenshots-grid">
                <img src="assets/screenshot1.png" alt="Partida en tiempo real" class="screenshot">
                <img src="assets/screenshot2.png" alt="Salón de la Fama y la Vergüenza" class="screenshot">
                <img src="assets/screenshot3.png" alt="Torneos y comodines" class="screenshot">
            </div>
        </div>
    </section>

    <!-- Call to action -->
    <section class="cta">
        <div class="container">
            <h2>¿Listo para jugar?</h2>
            <p>Descarga GRIDWAR ahora y únete a miles de jugadores en partidas épicas de Tres en Raya.</p>
            <a href="https://play.google.com/store/apps/details?id=com.gridwar.app" class="btn btn-primary">
                Descargar en Google Play
            </a>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <p>&copy; 2026 GRIDWAR. Todos los derechos reservados.</p>
            <div class="footer-links">
                <a href="#">Política de Privacidad</a>
                <a href="#">Términos de Servicio</a>
            </div>
        </div>
    </footer>

    <script src="js/main.js"></script>
</body>
</EOF>

# Create CSS
cat > css/style.css << 'EOF'
/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
}

.container {
    width: 90%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
.header {
    background: linear-gradient(135deg, #0a0e1a, #1a1f2e);
    color: white;
    text-align: center;
    padding: 80px 0 40px;
}

.header h1 {
    font-size: 3.5rem;
    margin-bottom: 10px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.header .tagline {
    font-size: 1.25rem;
    opacity: 0.9;
    max-width: 800px;
    margin: 0 auto;
}

/* Features section */
.features {
    padding: 80px 0;
    background-color: #fff;
}

.features h2 {
    text-align: center;
    margin-bottom: 50px;
    font-size: 2.5rem;
    color: #0a0e1a;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
}

.feature-card {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 15px rgba(0,0,0,0.15);
}

.feature-card h3 {
    color: #00f5ff;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.feature-card p {
    color: #555;
    line-height: 1.6;
}

/* How it works section */
.how-it-works {
    padding: 80px 0;
    background-color: #f8f9fa;
}

.how-it-works h2 {
    text-align: center;
    margin-bottom: 50px;
    font-size: 2.5rem;
    color: #0a0e1a;
}

.steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 30px;
    text-align: center;
}

.step {
    background: white;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 50px;
    background: #00f5ff;
    color: #0a0e1a;
    font-weight: bold;
    font-size: 1.5rem;
    border-radius: 50%;
    margin-bottom: 20px;
}

.step h3 {
    color: #0a0e1a;
    margin-bottom: 15px;
}

.step p {
    color: #666;
    font-size: 0.95rem;
}

/* Screenshots section */
.screenshots {
    padding: 80px 0;
    background-color: #fff;
}

.screenshots h2 {
    text-align: center;
    margin-bottom: 40px;
    font-size: 2.5rem;
    color: #0a0e1a;
}

.screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
}

.screenshot {
    width: 100%;
    height: auto;
    border-radius: 12px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    transition: transform 0.3s ease;
}

.screenshot:hover {
    transform: scale(1.03);
}

/* CTA section */
.cta {
    padding: 80px 0;
    background: linear-gradient(135deg, #00f5ff, #00c896);
    color: white;
    text-align: center;
}

.cta h2 {
    font-size: 2.5rem;
    margin-bottom: 20px;
}

.cta p {
    font-size: 1.25rem;
    margin-bottom: 30px;
    opacity: 0.9;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.btn {
    display: inline-block;
    padding: 15px 30px;
    background-color: rgba(0,0,0,0.2);
    color: white;
    text-decoration: none;
    border-radius: 50px;
    font-weight: bold;
    transition: all 0.3s ease;
    border: 2px solid white;
}

.btn:hover {
    background-color: rgba(0,0,0,0.3);
    transform: translateY(-3px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

/* Footer */
.footer {
    background-color: #0a0e1a;
    color: #aaa;
    text-align: center;
    padding: 30px 0;
}

.footer-links {
    margin-top: 15px;
}

.footer-links a {
    color: #aaa;
    text-decoration: none;
    margin: 0 10px;
    font-size: 0.9rem;
}

.footer-links a:hover {
    text-decoration: underline;
}

/* Responsive design */
@media (max-width: 768px) {
    .header h1 {
        font-size: 2.8rem;
    }
    
    .features h2,
    .how-it-works h2,
    .screenshots h2,
    .cta h2 {
        font-size: 2rem;
    }
    
    .header {
        padding: 60px 0 30px;
    }
    
    .features,
    .how-it-works,
    .screenshots,
    .cta {
        padding: 60px 0;
    }
}

@media (max-width: 480px) {
    .header h1 {
        font-size: 2.2rem;
    }
    
    .features-grid,
    .steps,
    .screenshots-grid {
        grid-template-columns: 1fr;
    }
}
EOF

# Create basic JS
cat > js/main.js << 'EOF'
// Basic JavaScript for landing page
document.addEventListener('DOMContentLoaded', function() {
    // Add any interactive elements here
    console.log('GRIDWAR Landing Page loaded');
    
    // Example: Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});
EOF

# Create placeholder assets info
cat > assets/README.md << 'EOF'
# Assets Directory

Place your game screenshots and icons here:

Required files:
- icon.png (512x512 px, will be used for the favicon)
- screenshot1.png (gameplay screenshot)
- screenshot2.png (features/shame hall screenshot)  
- screenshot3.png (tournaments/wildcards screenshot)

Recommended dimensions for screenshots:
- Width: 1080px (portrait orientation for mobile screenshots)
- Height: 1920px or similar aspect ratio

You can also add:
- feature-graphic.png (1024x500 px for Play Store)
- Graphic assets for promotional materials
EOF

# Initialize git if needed
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial commit: GRIDWAR landing page with GitHub Actions setup"
fi

echo "✅ Landing page setup complete!"
echo "📁 Files created:"
echo "   - index.html (main page)"
echo "   - css/style.css (styles)"
echo "   - js/main.js (JavaScript)"
echo "   - .github/workflows/deploy.yml (GitHub Actions)"
echo "   - assets/README.md (instructions for assets)"
echo ""
echo "🚀 Next steps:"
echo "1. Add your actual screenshots to the assets/ folder"
echo "2. Update the HTML to use your real asset filenames if needed"
echo "3. Commit and push to trigger GitHub Pages deployment"
echo "4. Your site will be available at: https://LordBenderGG.github.io/gridwar-landing/"
EOF

chmod +x github_landing_setup.sh
