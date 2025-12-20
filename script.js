const App = (function() {
    // --- state and configuration ---
    let config = {};
    let projects = [];
    let artists = [];
    
    // CONSTANT: define the specific tags you want to use as primary filters on the gallery page
    const VISIBLE_FILTER_TAGS = ["Design", "Music Production"];

    let state = {
        projects: {
            // now uses an array of activeTags to support multi-tag filtering
            filters: { activeTags: [] },
            sort: 'newest',
            search: ''
        },
        artists: {
            filters: { role: 'all' }
        },
        isModalOpen: false,
        activeSection: 'hero'
    };
    
    // check if the current page is the gallery page
    const IS_GALLERY_PAGE = window.location.pathname.includes('gallery.html');

    // --- DOM elements cache ---
    const DOM = {
        // app Structure
        appContent: document.getElementById('app-content'),
        errorBanner: document.getElementById('error-banner'),
        errorMessage: document.getElementById('error-message'),

        // ticker
        skillsTicker: document.getElementById('skills-ticker'),
        tickerContent: document.querySelector('.ticker-content'),

        // hero
        heroTagline: document.getElementById('hero-tagline'),

        // work (projects)
        projectsGrid: document.getElementById('projects-grid'),
        projectsEmptyState: document.getElementById('projects-empty-state'),
        sortSelect: document.getElementById('sort-select'),
        categoryFilters: document.getElementById('category-filters'), 
        searchInput: document.getElementById('search-input'), 

        // artists (may be null on gallery.html)
        artistsGrid: document.getElementById('artists-grid'),
        artistsEmptyState: document.getElementById('artists-empty-state'),
        artistRoleFilters: document.getElementById('artist-role-filters'),

        // about (may be null on gallery.html)
        aboutContent: document.getElementById('about-content'),

        // contact (may be null on gallery.html)
        contactEmailBtn: document.getElementById('contact-email-btn'),
        socialLinks: document.getElementById('social-links'),

        // modal
        modalOverlay: document.getElementById('content-modal'),
        modalContent: document.querySelector('.modal-content'),
        modalCloseBtn: document.querySelector('.modal-close'),
        modalBody: document.getElementById('modal-body'),
        focusableModalElements: null
    };

    // --- utility functions ---

    /* fetches JSON data with error handling and fallback */
    async function fetchData(url, type) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to load ${type} from ${url}:`, error);
            App.showErrorBanner(`Could not load ${type} data.`);
            // fallback config data 
            if (type === 'config') return { siteName: "JVN", tagline: "Portfolio", skills: ["Loading Failed..."] };
            return []; // fallback empty array for projects/artists
        }
    }

    /* helper to escape HTML for safety/templating */
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* simple check for reduced motion preference */
    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // --- data loading & initialization ---

    /* loads all application data from JSON files */
    async function loadData() {
        config = await fetchData('data/config.json', 'config');
        [projects, artists] = await Promise.all([
            fetchData('data/projects.json', 'projects'),
            fetchData('data/artists.json', 'artists')
        ]);

        projects = projects || [];
        artists = artists || [];
    }

    /* displays a visible error banner */
    function showErrorBanner(message) {
        if (DOM.errorBanner) {
            DOM.errorMessage.textContent = message;
            DOM.errorBanner.hidden = false;
            DOM.errorBanner.classList.add('is-visible');
        }
    }

    // --- ticker logic ---
    let currentSkillIndex = 0;
    let tickerInterval;

    function renderTicker() {
        if (!config.skills || config.skills.length === 0 || !DOM.skillsTicker) {
            if (DOM.skillsTicker) DOM.skillsTicker.style.display = 'none';
            return;
        }

        // use the default meta-text on the gallery page
        if (IS_GALLERY_PAGE) {
            // content is already set in HTML for gallery
            return;
        }

        // on homepage, render dynamic skills
        if (DOM.tickerContent) DOM.tickerContent.innerHTML = '';
        
        config.skills.forEach((skill, index) => {
            const span = document.createElement('span');
            span.className = `ticker-skill`;
            span.textContent = `JVN // ${(skill)}`;
            span.setAttribute('aria-hidden', 'true');
            span.setAttribute('role', 'status');
            span.setAttribute('id', `skill-${index}`);

            if (index === 0) {
                span.classList.add(`active-fade`);
                span.setAttribute('aria-hidden', 'false');
            }
            if (DOM.tickerContent) DOM.tickerContent.appendChild(span);
        });

        if (!prefersReducedMotion() && config.tickerIntervalMs > 0 && config.skills.length > 1) {
            startTickerRotation();
        }

        if (config.pauseOnHover && config.tickerIntervalMs > 0 && DOM.skillsTicker) {
            DOM.skillsTicker.addEventListener('mouseenter', pauseTickerRotation);
            DOM.skillsTicker.addEventListener('mouseleave', startTickerRotation);
        }
    }

    function startTickerRotation() {
        if (tickerInterval) return;
        tickerInterval = setInterval(rotateTicker, config.tickerIntervalMs);
    }

    function pauseTickerRotation() {
        clearInterval(tickerInterval);
        tickerInterval = null;
    }
    
    function rotateTicker() {
        const skills = document.querySelectorAll('.ticker-skill');
        if (skills.length === 0) return;
        
        const nextSkillIndex = (currentSkillIndex + 1) % skills.length;
        const currentSkill = skills[currentSkillIndex];
        const nextSkill = skills[nextSkillIndex];

        if (currentSkill) {
            currentSkill.classList.remove('active-fade');
            currentSkill.setAttribute('aria-hidden', 'true');
        }
        if (nextSkill) {
            nextSkill.classList.add('active-fade');
            nextSkill.setAttribute('aria-hidden', 'false');
        }

        currentSkillIndex = nextSkillIndex;
    }

    // --- project / work logic ---

    /* renders the project filter chips (Tags) */
    function renderProjectFilters() {
        if (!DOM.categoryFilters) return; // only run on gallery page
        DOM.categoryFilters.innerHTML = '';
        
        // use the hardcoded list of visible tags
        const tagsToRender = VISIBLE_FILTER_TAGS;
        
        const activeTags = state.projects.filters.activeTags;

        // 1. render 'All Tags' reset chip
        const allChip = createChip('All Tags', 'all', activeTags.length === 0, 'tag', 'tag');
        DOM.categoryFilters.appendChild(allChip);

        // 2. render only the defined, visible tags
        tagsToRender.forEach(tag => {
            const isActive = activeTags.includes(tag);
            const chip = createChip(tag, tag, isActive, 'tag', 'tag');
            DOM.categoryFilters.appendChild(chip);
        });
    }

    /* creates an interactive filter chip element */
    function createChip(label, value, isActive, type, group) {
        const chip = document.createElement('span');
        chip.className = `chip ${isActive ? 'active' : ''} ${value === 'all' ? 'chip-reset' : ''}`;
        chip.textContent = escapeHtml(label);
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        chip.setAttribute('data-filter-type', type);
        chip.setAttribute('data-filter-value', value);
        chip.setAttribute('aria-pressed', isActive);
        
        return chip;
    }
    
    /* handles the logic when a project filter chip is clicked (multi-select logic) */
    function handleProjectFilterClick(type, value) {
        if (type === 'tag') {
            let activeTags = [...state.projects.filters.activeTags];

            if (value === 'all') {
                activeTags = []; // reset all tags
            } else if (activeTags.includes(value)) {
                activeTags = activeTags.filter(tag => tag !== value); // remove tag
            } else {
                activeTags.push(value); // add tag
            }
            
            state.projects.filters.activeTags = activeTags;
            renderProjectFilters(); 
            renderProjects(IS_GALLERY_PAGE ? Infinity : 4);
        }
    }
    
    /* sorts and filters the projects based on current state */
    function getFilteredAndSortedProjects() {
        let filtered = projects;
        const { filters, sort, search } = state.projects;
        const activeTags = filters.activeTags;

        // FILTER LOGIC: project must match AT LEAST ONE active tag
        if (activeTags.length > 0) {
            filtered = filtered.filter(p => 
                activeTags.some(activeTag => p.tags.includes(activeTag))
            );
        }

        // search is now only run if the searchInput element existed on the page 
        if (DOM.searchInput && search) {
            const searchTerm = search.toLowerCase();
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(searchTerm) ||
                p.description.toLowerCase().includes(searchTerm) ||
                p.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }
        
        function parseYearMonth(str) {
            if (!str) return new Date(0);
            // try to parse 'month YYYY' or just 'YYYY'
            const months = [
                'january','february','march','april','may','june','july','august','september','october','november','december'
            ];
            if (/^\d{4}$/.test(str)) {
                return new Date(Number(str), 0, 1);
            }
            const match = str.match(/^(\w+)\s+(\d{4})$/i);
            if (match) {
                const monthIdx = months.indexOf(match[1].toLowerCase());
                const year = Number(match[2]);
                return new Date(year, monthIdx >= 0 ? monthIdx : 0, 1);
            }
            return new Date(str); // fallback
        }
        filtered.sort((a, b) => {
            if (sort === 'newest') return parseYearMonth(b.year) - parseYearMonth(a.year);
            if (sort === 'oldest') return parseYearMonth(a.year) - parseYearMonth(b.year);
            if (sort === 'a-z') return a.title.localeCompare(b.title);
            if (sort === 'z-a') return b.title.localeCompare(a.title);
            return 0;
        });

        return filtered;
    }

    /* renders the list of project cards, with an optional limit for the homepage */
    function renderProjects(limit = Infinity) {
        if (!DOM.projectsGrid) return;
        
        let projectsToRender = getFilteredAndSortedProjects();
        const initialCount = projectsToRender.length;
        
        if (limit !== Infinity) { // This is the homepage showcase (limit is small)

            // if the config defines an explicit `homeShowcase` array of project IDs,
            // use that list (preserving order) and fill any remaining slots with
            // featured / other projects until we hit the requested limit
            if (Array.isArray(config.homeShowcase) && config.homeShowcase.length > 0) {
                const selected = config.homeShowcase
                    .map(id => projectsToRender.find(p => p.id === id))
                    .filter(Boolean);

                if (selected.length < limit) {
                    const remainder = projectsToRender.filter(p => !selected.includes(p));
                    remainder.sort((a, b) => ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)));
                    selected.push(...remainder.slice(0, limit - selected.length));
                }

                projectsToRender = selected.slice(0, limit);
            } else {
                // fallback: prioritize featured projects, then slice to the requested limit
                projectsToRender.sort((a, b) => {
                    const featuredA = a.featured ? 1 : 0;
                    const featuredB = b.featured ? 1 : 0;
                    return featuredB - featuredA || 0;
                });
                projectsToRender = projectsToRender.slice(0, limit);
            }

            // hide empty state on homepage regardless
            if (DOM.projectsEmptyState) DOM.projectsEmptyState.hidden = true;
        } else { // gallery page logic
            if (DOM.projectsEmptyState) DOM.projectsEmptyState.hidden = initialCount > 0;
        }

        DOM.projectsGrid.innerHTML = '';

        projectsToRender.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'link');
            card.setAttribute('aria-label', `View project ${project.title}`);

            const thumb = project.thumb ? `<img src="${escapeHtml(project.thumb)}" alt="${escapeHtml(project.title)} thumbnail" class="project-thumb">` : 
                                         `<div class="project-thumb" style="display:flex; align-items:center; justify-content:center; color:var(--color-text-secondary);">NO IMAGE</div>`;
            
            const tagsList = project.tags.map(t => `<span class="project-tag-item">${escapeHtml(t)}</span>`).join(' • ');
            
            const metadataHtml = project.role ? `<span>Role: ${escapeHtml(project.role)}</span>` : '';

            card.innerHTML = `
                ${thumb}
                <div class="project-info">
                    <h3>${escapeHtml(project.title)}</h3>
                    <div class="project-metadata">
                        <span>${escapeHtml(project.year)}</span>
                        ${metadataHtml}
                    </div>
                    <p class="project-tags">${tagsList}</p>
                </div>
            `;
            // listener attached directly to card
            card.addEventListener('click', () => openProjectModal(project.id));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openProjectModal(project.id);
                }
            });
            DOM.projectsGrid.appendChild(card);
        });
    }
    
    /* sets up event listeners for project filtering and sorting (only for gallery page) */
    function setupProjectsControls() {
        if (!IS_GALLERY_PAGE) return;
        
        // 1. Sort listener
        if (DOM.sortSelect) {
            DOM.sortSelect.addEventListener('change', (e) => {
                state.projects.sort = e.target.value;
                renderProjects(Infinity); 
            });
        }
        
        // 2. category filter listener (event delegation)
        if (DOM.categoryFilters) {
            DOM.categoryFilters.addEventListener('click', (e) => {
                const target = e.target.closest('.chip');
                if (target && target.dataset.filterType === 'tag') {
                    handleProjectFilterClick('tag', target.dataset.filterValue);
                }
            });
            DOM.categoryFilters.addEventListener('keydown', (e) => {
                 if (e.key === 'Enter' || e.key === ' ') {
                    const target = e.target.closest('.chip');
                    if (target && target.dataset.filterType === 'tag') {
                        e.preventDefault();
                        handleProjectFilterClick('tag', target.dataset.filterValue);
                    }
                }
            });
        }
    }
    
    // --- artist logic ---

    function renderArtistFilters() {
        if (!DOM.artistRoleFilters) return;
        DOM.artistRoleFilters.innerHTML = '';
        const allRoles = artists.reduce((set, a) => set.add(a.role), new Set());

        const allChip = createChip('All Roles', 'all', state.artists.filters.role === 'all', 'artist-role', 'role');
        DOM.artistRoleFilters.appendChild(allChip);

        Array.from(allRoles).sort().forEach(role => {
            const isActive = state.artists.filters.role === role;
            const chip = createChip(role, role, isActive, 'artist-role', 'role');
            DOM.artistRoleFilters.appendChild(chip);
        });
    }

    function handleArtistFilterClick(type, value) {
        if (type === 'artist-role') {
            state.artists.filters.role = value;
            renderArtistFilters();
            renderArtists();
        }
    }
    
    function renderArtists() {
        if (!DOM.artistsGrid) return;
        const { role } = state.artists.filters;
        let filteredArtists = artists;

        if (role !== 'all') {
            filteredArtists = filteredArtists.filter(a => a.role === role);
        }

        DOM.artistsGrid.innerHTML = '';
        if (DOM.artistsEmptyState) DOM.artistsEmptyState.hidden = filteredArtists.length > 0;

        filteredArtists.forEach(artist => {
            const card = document.createElement('div');
            card.className = 'artist-card';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'link');
            card.setAttribute('aria-label', `View details for ${artist.name}`);

            const img = artist.image ? `<img src="${escapeHtml(artist.image)}" alt="${escapeHtml(artist.name)}" class="artist-img">` :
                                      `<div class="artist-img" style="background-color:var(--color-bg-secondary); display:flex; align-items:center; justify-content:center; color:var(--color-text-secondary); font-size:0.8rem;">?</div>`;

            card.innerHTML = `
                ${img}
                <div class="artist-info">
                    <h3>${escapeHtml(artist.name)}</h3>
                    <p>${escapeHtml(artist.role)} | ${escapeHtml(artist.yearRange)}</p>
                </div>
            `;
            // listener attached directly to card
            card.addEventListener('click', () => openArtistModal(artist.name));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openArtistModal(artist.name);
                }
            });
            DOM.artistsGrid.appendChild(card);
        });
    }

    function setupArtistControls() {
        if (!DOM.artistRoleFilters) return;
        
        // 1. initial render
        renderArtistFilters();
        
        // 2. listener (event delegation)
        DOM.artistRoleFilters.addEventListener('click', (e) => {
            const target = e.target.closest('.chip');
            if (target && target.dataset.filterType === 'artist-role') {
                handleArtistFilterClick('artist-role', target.dataset.filterValue);
            }
        });
        DOM.artistRoleFilters.addEventListener('keydown', (e) => {
             if (e.key === 'Enter' || e.key === ' ') {
                const target = e.target.closest('.chip');
                if (target && target.dataset.filterType === 'artist-role') {
                    e.preventDefault();
                    handleArtistFilterClick('artist-role', target.dataset.filterValue);
                }
            }
        });
    }

    // --- modal logic (project & artist) ---

    function renderProjectModalContent(project) {
        if (!DOM.modalBody) return;
        
        let galleryHtml = '';
        if (project.gallery && project.gallery.length > 0) {
            const itemsHtml = project.gallery.map(item => {
                // support both string entries and object entries with { label, url }
                if (typeof item === 'string') {
                    return `<figure class="gallery-item"><img src="${escapeHtml(item)}" alt="${escapeHtml(project.title)} image" style="width:100%; height:auto; display:block; margin-bottom:0.5rem;"><figcaption class="gallery-caption" aria-hidden="true">${escapeHtml(project.title)}</figcaption></figure>`;
                }
                if (typeof item === 'object' && item !== null && item.url) {
                    const label = item.label ? escapeHtml(item.label) : escapeHtml(project.title);
                    return `<figure class="gallery-item"><img src="${escapeHtml(item.url)}" alt="${label}" style="width:100%; height:auto; display:block; margin-bottom:0.5rem;"><figcaption class="gallery-caption">${label}</figcaption></figure>`;
                }
                return '';
            }).join('');

            galleryHtml = `<div class="modal-section modal-gallery">
                <h3>Gallery</h3>
                ${itemsHtml}
            </div>`;
        }

        const audioHtml = project.audio && project.audio.src ?
            `<div class="modal-section modal-audio">
                <h3>Audio Preview: ${escapeHtml(project.audio.title || 'Untitled Track')}</h3>
                <div class="audio-player-container">
                    <audio controls src="${escapeHtml(project.audio.src)}" style="width:100%;">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            </div>` : '';

        const linksHtml = project.links && project.links.length > 0 ?
            `<div class="modal-section modal-links">
                <h3>Links</h3>
                <ul class="modal-links-list">
                    ${project.links.map(link => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} →</a></li>`).join('')}
                </ul>
            </div>` : '';
            
        const tagsList = project.tags.join(', ');
        const role = escapeHtml(project.role);
        
        DOM.modalBody.innerHTML = `
            <div class="modal-header">
                <h2 id="modal-title">${escapeHtml(project.title)}</h2>
                <div class="modal-meta">
                    <span>Year: ${escapeHtml(project.year)}</span>
                    <span>Role: <strong>${role}</strong></span>
                </div>
            </div>
            
            <div class="modal-section modal-description">
                <h3>Summary</h3>
                ${Array.isArray(project.description) ? `<p>${project.description.map(d => escapeHtml(d)).join('<br><br>')}</p>` : `<p>${escapeHtml(project.description)}</p>`}
            </div>
            
            ${linksHtml}
            ${audioHtml}
            ${galleryHtml}

            <div class="modal-section modal-tags">
                <h3>Tags</h3>
                <p>${tagsList}</p>
            </div>
        `;
        openModal();
    }
    
function renderArtworkModalContent(artwork) {
        if (!DOM.modalBody) return;
        
        let galleryHtml = '';
        if (artwork.gallery && artwork.gallery.length > 0) {
            const itemsHtml = artwork.gallery.map(item => {
                if (typeof item === 'string') {
                    return `<figure class="gallery-item"><img src="${escapeHtml(item)}" alt="${escapeHtml(artwork.title)}" class="modal-gallery-item" style="width:100%; height:auto; display:block; margin-bottom:0.5rem;"><figcaption class="gallery-caption" aria-hidden="true">${escapeHtml(artwork.title)}</figcaption></figure>`;
                }
                if (typeof item === 'object' && item !== null && item.url) {
                    const label = item.label ? escapeHtml(item.label) : escapeHtml(artwork.title);
                    return `<figure class="gallery-item"><img src="${escapeHtml(item.url)}" alt="${label}" class="modal-gallery-item" style="width:100%; height:auto; display:block; margin-bottom:0.5rem;"><figcaption class="gallery-caption">${label}</figcaption></figure>`;
                }
                return '';
            }).join('');

            galleryHtml = `<div class="modal-section modal-gallery">
                ${itemsHtml}
            </div>`;
        }

        const tagsList = artwork.tags ? artwork.tags.join(', ') : '';
        const tagsHtmlSection = tagsList ? `<div class="modal-section modal-tags"><h3>Tags</h3><p>${tagsList}</p></div>` : ''; 

        DOM.modalBody.innerHTML = `
            <div class="modal-header">
                <h2 id="modal-title">${escapeHtml(artwork.title)}</h2>
                <div class="modal-meta">
                    <span>Year: ${escapeHtml(artwork.year)}</span>
                </div>
            </div>
            
            ${galleryHtml}
            ${tagsHtmlSection}
        `;
        openModal();
    }

    function renderArtistModalContent(artist) {
        if (!DOM.modalBody) return;
        
        const worksHtml = artist.notableWorks && artist.notableWorks.length > 0 ?
            `<div class="modal-section modal-notable-works">
                <h3>Notable Works</h3>
                <ul class="modal-notable-works-list">
                    ${artist.notableWorks.map(work => `<li>${escapeHtml(work)}</li>`).join('')}
                </ul>
            </div>` : '';

        const linksHtml = artist.links && artist.links.length > 0 ?
            `<div class="modal-section modal-links">
                <h3>Links</h3>
                <ul class="modal-links-list">
                    ${artist.links.map(link => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} →</a></li>`).join('')}
                </ul>
            </div>` : '';
            
        const img = artist.image ? `<img src="${escapeHtml(artist.image)}" alt="${escapeHtml(artist.name)}" style="width:100%; max-width:150px; height:150px; border-radius:50%; object-fit:cover; margin: 0 auto 1rem; display:block;">` : '';

        DOM.modalBody.innerHTML = `
            <div class="modal-header" style="text-align:center;">
                ${img}
                <h2 id="modal-title">${escapeHtml(artist.name)}</h2>
                <div class="modal-meta" style="justify-content:center;">
                    <span>Role: <strong>${escapeHtml(artist.role)}</strong></span>
                    <span>Years: <strong>${escapeHtml(artist.yearRange)}</strong></span>
                </div>
            </div>
            
            ${worksHtml}
            ${linksHtml}
        `;
        openModal();
    }
    
    function openProjectModal(projectId) {
        const item = projects.find(p => p.id === projectId);
        if (item) {
            if (item.type === 'artwork') {
                renderArtworkModalContent(item);
            } else {
                renderProjectModalContent(item);
            }
            history.pushState(null, '', `#project=${projectId}`);
        }
    }
    
    function openArtistModal(artistName) {
        const artist = artists.find(a => a.name === artistName);
        if (artist) {
            renderArtistModalContent(artist);
        }
    }

    function openModal() {
        if (!DOM.modalOverlay || state.isModalOpen) return;

        state.isModalOpen = true;
        DOM.modalOverlay.hidden = false;
        requestAnimationFrame(() => DOM.modalOverlay.classList.add('is-visible'));
        document.body.style.overflow = 'hidden'; 
        
        // focus management: focus the close button for accessibility
        if (DOM.modalCloseBtn) {
            DOM.modalCloseBtn.focus();
        }
    }

    function closeModal() {
        if (!DOM.modalOverlay || !state.isModalOpen) return;

        state.isModalOpen = false;
        DOM.modalOverlay.classList.remove('is-visible');
        document.body.style.overflow = '';

        const cleanUrl = window.location.href.split('#')[0];
        history.pushState(null, '', cleanUrl);

        setTimeout(() => {
            DOM.modalOverlay.hidden = true;
            if (DOM.modalBody) DOM.modalBody.innerHTML = '';
        }, 300);
    }

    // --- about & contact logic ---

    /* renders content for the about section */
    function renderAbout() {
        if (!DOM.aboutContent) return; // Only run on homepage
        const { aboutHeadline, aboutBody, location, email } = config;

        let metaHtml = '';
        if (location || email) {
            metaHtml = `<div class="about-meta">
                ${location ? `<p>Location: <strong>${escapeHtml(location)}</strong></p>` : ''}
                ${email ? `<p>Email: <strong>${escapeHtml(email)}</strong></p>` : ''}
            </div>`;
        }

        // handle multiline body for paragraphs
        const bodyParagraphs = aboutBody ? aboutBody.split('\n').map(p => p.trim()).filter(p => p.length > 0).map(p => `<p>${p}</p>`).join('') : '<p>About section content missing.</p>';

        DOM.aboutContent.innerHTML = `
            <h3>${escapeHtml(aboutHeadline || 'A Creative Portfolio')}</h3>
            ${bodyParagraphs}
            ${metaHtml}
        `;
    }

    /* renders content for the contact section */
    function renderContact() {
        if (!DOM.contactEmailBtn) return; // only run on homepage
        const { email, socials } = config;

        DOM.contactEmailBtn.href = `mailto:${escapeHtml(email || 'hello@example.com')}`;
        
        if (DOM.socialLinks) DOM.socialLinks.innerHTML = '';
        if (socials && socials.length > 0 && DOM.socialLinks) {
            socials.forEach(s => {
                const a = document.createElement('a');
                a.href = escapeHtml(s.url);
                a.textContent = (s.label);
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                DOM.socialLinks.appendChild(a);
            });
        }
    }

    // --- navigation & observer logic ---

    /* sets up the IntersectionObserver for scroll-based active link highlight */
    function setupIntersectionObserver() {
        if (IS_GALLERY_PAGE) return;
        
        const sections = document.querySelectorAll('main section[data-section]');
        const navLinks = document.querySelectorAll('.navbar-links a');
        
        const observerOptions = {
            root: null, 
            rootMargin: '0px 0px -60% 0px', 
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const link = document.querySelector(`.navbar-links a[href="#${id}"]`);

                if (entry.isIntersecting && id) {
                    navLinks.forEach(l => l.classList.remove('active'));
                    if (link) {
                        link.classList.add('active');
                        state.activeSection = id;
                    }
                }
            });
        }, observerOptions);

        sections.forEach(section => observer.observe(section));
    }

    /* handles deep linking for project modals on page load */
    function handleDeepLinking() {
        const hash = window.location.hash;
        const projectMatch = hash.match(/#project=([^&]+)/);
        
        if (projectMatch && projects.length > 0) {
            const projectId = projectMatch[1];
            // use setTimeout to ensure all DOM elements are rendered before scrolling/opening modal
            setTimeout(() => {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    const workSection = document.getElementById('work');
                    if(workSection) workSection.scrollIntoView();
                    openProjectModal(projectId);
                }
            }, 50); 
        }
    }

    // --- global setup & init ---

    /* main initialization function */
    async function init() {
        // 1. load Data
        await loadData();
        
        // 2. render global/config-driven content
        if (DOM.heroTagline) DOM.heroTagline.textContent = config.tagline || 'Creative Portfolio';
        renderTicker();
        
        // 3. conditional content and controls
        if (IS_GALLERY_PAGE) {
            setupProjectsControls(); // full controls (sort, category filter)
            renderProjectFilters(); 
            renderProjects(Infinity); // render all projects
        } else {
            // homepage: limited showcase, full artists/about/contact
            renderProjects(3);
            renderArtists();
            setupArtistControls();
            renderAbout();
            renderContact();
            setupIntersectionObserver();
        }

        // 4. Global Modal Listeners
        if (DOM.modalCloseBtn) DOM.modalCloseBtn.addEventListener('click', closeModal);
        if (DOM.modalOverlay) {
            DOM.modalOverlay.addEventListener('click', (e) => {
                if (e.target === DOM.modalOverlay) {
                    closeModal();
                }
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.isModalOpen) {
                closeModal();
            }
        });

        // 5. handle initial routing
        handleDeepLinking();
        
        console.log(`App Initialized Successfully. Page: ${IS_GALLERY_PAGE ? 'Gallery' : 'Home'}`);
    }

    // return the public interface (only init and showErrorBanner are needed globally)
    return {
        init,
        showErrorBanner // expose for external error handling
    };
})();

// initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', App.init);