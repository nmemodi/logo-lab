/* ═══════════════════════════════════════════════════════════════
   LOGO TOOLS — Canonical Registry
   Single source of truth for the 10 tools. Consumed by:
     - /logo/index.html         (landing doc sections)
     - /shared/tools-nav.js     (inter-tool dropdown switcher)

   Each entry:
     slug     — URL segment; path is /logo/<slug>/
     name     — display name
     svg      — curated inline SVG mark using currentColor (themeable)
     tagline  — one-line summary for landing section subheader
     blurb    — prose for landing section. Plain text; blank-line ("\n\n")
                  separators split into multiple <p> elements at render time.
     defaultSeed — seed used by the landing's embedded preview
     credit   — inspiration citation (historical logo). Fields:
                  work      — original logo title/company
                  designers — list of { name, url? } objects (url is the
                              logobook.com /designer/<slug>/ page when one
                              exists, otherwise null/omitted)
                  year      — year published
                  url       — logobook.com /logo/<slug>/ link for the work
                              itself (null when unlisted)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const ICONS = {
    lineWarp: '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14H68"/><path d="M12 27H25C33 27 34 21 40 21C46 21 47 27 55 27H68"/><path d="M12 40H22C32 40 32 27 40 27C48 27 48 40 58 40H68"/><path d="M12 53H24C32 53 33 44 40 44C47 44 48 53 56 53H68"/><path d="M12 66H68"/></svg>',
    brutalistLetters: '<svg viewBox="0 0 80 80" fill="currentColor"><path d="M22 14H58C62.5 14 66 17.5 66 22V31H53V26H29V54H53V47H41V35H66V58C66 62.5 62.5 66 58 66H22C17.5 66 14 62.5 14 58V22C14 17.5 17.5 14 22 14Z"/></svg>',
    interlockingCircles: '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"><circle cx="40" cy="25" r="14"/><circle cx="27" cy="37" r="14"/><circle cx="53" cy="37" r="14"/><circle cx="32" cy="54" r="14"/><circle cx="48" cy="54" r="14"/></svg>',
    parallelLetters: '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-linejoin="miter" stroke-linecap="butt"><path stroke-width="4.5" d="M19 69V11H45C59 11 69 21 69 35C69 49 59 58 45 58H31V69"/><path stroke-width="3.6" d="M30 65V22H44C53 22 59 28 59 36C59 44 53 49 44 49H39V65"/><path stroke-width="2.8" d="M40 60V32H44C49 32 52 35 52 39C52 43 49 46 44 46"/></svg>',
    shapeTiles: '<svg viewBox="0 0 80 80" fill="currentColor"><circle cx="40" cy="40" r="11"/><path d="M28 28a12 12 0 0 1 24 0Z"/><path d="M28 52a12 12 0 0 0 24 0Z"/><path d="M28 28a12 12 0 0 0 0 24Z"/><path d="M52 28a12 12 0 0 1 0 24Z"/><path d="M14 14H29A15 15 0 0 1 14 29Z"/><path d="M66 14V29A15 15 0 0 1 51 14Z"/><path d="M66 66H51A15 15 0 0 1 66 51Z"/><path d="M14 66V51A15 15 0 0 1 29 66Z"/></svg>',
    slicedShapes: '<svg viewBox="0 0 80 80" fill="currentColor" fill-rule="evenodd"><path d="M40 12A28 28 0 1 1 40 68A28 28 0 1 1 40 12ZM14 38.5C24 32.5 33 36 42 44C50 51 57 53.5 64 50L64 54.5C55 58.5 47 56 38 48C30 41 23 38.8 14 44.5Z"/></svg>',
    slashMark: '<svg viewBox="0 0 80 80" fill="currentColor"><path d="M40 10L48 25H32Z"/><path d="M29 31H51L58 43H22Z"/><path d="M21 48H59L65 60H15Z"/><path d="M13 65H67L72 72H8Z"/></svg>',
    polygonRosette: '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="miter" stroke-linecap="square"><path d="M40 10L61 19L70 40L61 61L40 70L19 61L10 40L19 19Z"/><path d="M40 10V70"/><path d="M10 40H70"/><path d="M19 19L61 61"/><path d="M61 19L19 61"/></svg>',
    echoStripes: '<svg viewBox="0 0 80 80" fill="currentColor"><rect x="13" y="10" width="54" height="5"/><rect x="13" y="17" width="54" height="5"/><rect x="13" y="24" width="23" height="5"/><rect x="13" y="31" width="23" height="5"/><rect x="13" y="38" width="45" height="5"/><rect x="13" y="45" width="45" height="5"/><rect x="13" y="52" width="23" height="5"/><rect x="13" y="59" width="23" height="5"/><rect x="13" y="66" width="54" height="5"/><rect x="13" y="73" width="54" height="5"/></svg>',
    dotGrid: '<svg viewBox="0 0 80 80" fill="currentColor"><circle cx="18" cy="16" r="4"/><circle cx="30" cy="16" r="4"/><circle cx="42" cy="16" r="4"/><circle cx="18" cy="28" r="4"/><circle cx="30" cy="28" r="4"/><circle cx="42" cy="28" r="4"/><circle cx="18" cy="40" r="4"/><circle cx="30" cy="40" r="4"/><circle cx="42" cy="40" r="4"/><circle cx="18" cy="52" r="4"/><circle cx="30" cy="52" r="4"/><circle cx="42" cy="52" r="4"/><circle cx="18" cy="64" r="4"/><circle cx="30" cy="64" r="4"/><circle cx="42" cy="64" r="4"/><circle cx="54" cy="64" r="4"/><circle cx="66" cy="64" r="4"/></svg>'
  };

  const TOOLS = [
    {
      slug: 'line-warp',
      name: 'Line Warp',
      tagline: 'Horizontal lines displaced by a letter heightmap.',
      blurb: 'Francesco Burcini\'s Solfer mark (1978) drew an "S" by stacking horizontal lines and lifting each one upward as if the letter were a topology, giving a flat field a sense of relief.\n\nThe tool takes that idea and opens it up to any letter and font. Set the line count and how far each line displaces, and the character emerges from the field like a contour map.',
      defaultSeed: '42',
      variants: [
        'v=1',
        'v=1&f=Futura&g=0.7&iv=1&ls=1&lt=V&n=6&oy=114&rd=100',
        'v=1&f=Futura&g=0.7&iv=1&ls=1&lt=K&m=34&n=23&oy=86&rd=100',
        'v=1&cr=0&f=Futura&g=0.7&ls=1&lt=O&m=34&n=9&oy=86&rd=100'
      ],
      credit: {
        work: 'Solfer',
        designers: [
          { name: 'Francesco Burcini', url: 'https://logobook.com/designer/francesco-burcini/' }
        ],
        year: 1978,
        url: 'https://logobook.com/logo/solfer/'
      },
      svg: ICONS.lineWarp
    },
    {
      slug: 'brutalist-letters',
      name: 'Brutalist Letters',
      tagline: 'Cut letters out of solid blocks with right-angle paths.',
      blurb: 'Klaus Grötzinger and Peter Riefenstahl built the Hans-Joachim Gericke architectural mark (1966) by cutting a single right-angle path through a rounded square — letter and frame as one solid, architectural object. The output reads more like a pictogram than a letter.\n\nThe tool uses that concept on any character with only corner radius, cut width, and cut depth as the parameters to change the silhouette.',
      defaultSeed: '7',
      variants: [
        'v=1&cr=16&dp=147&lw=18&pa=12',
        'v=1&bg=e0e0e0&ch=K&cr=16&dp=147&fg=8c00ff&lw=18&pa=12',
        'v=1&bg=cec1cd&ch=L&cr=16&dp=132&fg=7e7987&lw=14&pa=12',
        'v=1&bg=12122b&ch=R&cr=16&dp=132&fg=ffc852&lw=14&pa=12'
      ],
      credit: {
        work: 'Hans-Joachim Gericke',
        designers: [
          { name: 'Klaus Grötzinger', url: 'https://logobook.com/designer/klaus-grozinger/' },
          { name: 'Peter Riefenstahl', url: 'https://logobook.com/designer/peter-riefenstahl/' }
        ],
        year: 1966,
        url: 'https://logobook.com/logo/hans-joachim-gericke/'
      },
      svg: ICONS.brutalistLetters
    },
    {
      slug: 'interlocking-circles',
      name: 'Interlocking Circles',
      tagline: 'Overlapping rings with controlled break-and-weave.',
      blurb: 'Koichi Watanabe\'s Ota Dental Clinic mark (1974) is two outlined rings in a tight coupling, woven where they cross.\n\nThe tool extends that idea to anything from two to fifteen rings, with ring, grid, or line layouts. A weave toggle controls which ring sits on top at every intersection.\n\nPro tip: any circle can be dragged to a new position directly on the canvas.',
      defaultSeed: '3',
      variants: [
        'v=1&bg=060d2d&br=0&fg=ebeaea&gp=0.5&ly=ring&n=7&r=75&ro=91&sp=91&sw=30',
        'v=1&ro=90&sw=46',
        'v=1&bg=72ff14&br=0&fg=000000&gp=2.9&ly=ring&n=5&nb=2&r=138&sp=161&sw=13',
        'v=1&bg=ffffff&br=0&fg=000000&gp=2.9&ly=ring&n=4&r=87&sp=68&sw=62'
      ],
      credit: {
        work: 'Ota Dental Clinic',
        designers: [
          { name: 'Koichi Watanabe', url: 'https://logobook.com/designer/koichi-watanabe/' }
        ],
        year: 1974,
        url: 'https://logobook.com/logo/ota-dental-clinic/'
      },
      svg: ICONS.interlockingCircles
    },
    {
      slug: 'parallel-letters',
      name: 'Parallel Letters',
      tagline: 'Letters drawn with vertical strip cuts through a solid fill.',
      blurb: 'John B. Castle\'s Five G mark (1966) is the letter G drawn as a series of nested concentric outlines, each ring slightly inset from the last.\n\nThe tool generalizes to any character with knobs for count, thickness, and gap. Sharp, round, or beveled joins change the entire feel.',
      defaultSeed: '12',
      variants: [
        'v=1&bg=673c40&f=Arial%20Black&g=1&jo=miter&n=7&sz=400&t=10',
        'v=1&bg=000000&ch=Y&f=Georgia&g=23&jo=miter&n=3&sz=400&t=9',
        'v=1&bg=ffffff&ch=N&fg=000000&g=2&n=7&sz=600&t=10',
        'v=1&bg=020066&ch=W&g=24&jo=bevel&sz=900&t=10'
      ],
      credit: {
        work: 'Five G Marketing',
        designers: [
          { name: 'John B. Castle', url: 'https://logobook.com/designer/john-b-castle/' },
          { name: 'Castle, Chappell and Partners', url: null }
        ],
        year: 1966,
        url: 'https://logobook.com/logo/five-g/'
      },
      svg: ICONS.parallelLetters
    },
    {
      slug: 'shape-tiles',
      name: 'Shape Tiles',
      tagline: 'A single shape tiled across a grid at deterministic rotations.',
      blurb: 'Vance Jonson\'s Dayton Hudson mark (1970s) is a grid of circles and half-circles — a single primitive repeated, cut, and rotated to form a coherent block.\n\nThe tool lets you pick one shape (circle, ring, petal, diamond, cross), then set size, gap, and rotation. Two or three tweaks is usually all it takes to land on something distinctive.',
      defaultSeed: '5',
      variants: [
        'v=1&g=120',
        'v=1&bg=ff47dd&fg=2e2d29&g=85&rt=68&sh=diamond&sz=240',
        'v=1&bg=0b562f&fg=ffffff&g=97&rt=45&sh=petal&sz=241',
        'v=1&bg=000000&fg=ffffff&g=97&rt=45&sh=ring&sz=241'
      ],
      credit: {
        work: 'Dayton Hudson Corporation',
        designers: [
          { name: 'Vance Jonson', url: 'https://logobook.com/designer/vance-jonson/' }
        ],
        year: '1970s',
        url: 'https://logobook.com/logo/dayton-hudson-corporation/'
      },
      svg: ICONS.shapeTiles
    },
    {
      slug: 'sliced-shapes',
      name: 'Sliced Shapes',
      tagline: 'Primitives cut by negative arcs to reveal the shape behind.',
      blurb: 'Ippo Miyamoto and Tadashi Ishikawa drew the Fujisankei Kokukusha mark (1978) as a row of circles cut by curves — the negative-space slice giving motion and depth to a simple pattern.\n\nThe tool expands on the cut: arc, sine, straight, S-curve, or zigzag, applied to any of several base shapes, repeated up to twelve times across the canvas. Curvature, slice width, and spacing determine whether the row reads as one shape or many.',
      defaultSeed: '9',
      variants: [
        'v=1&as=0&ba=6&bg=f4f3f1&c=1&cu=0.24&cv=s-curve&fc=2d04ba&gw=18.4&lc=2d04ba&sd=1kxombe&so=0.08&sp=176&sz=117',
        'v=1&as=0&ba=-7&bg=000000&c=2&cu=0&fc=ffffff&gw=28&sh=diamond&sp=122&sz=128',
        'v=1&as=0&ba=-180&bg=d6ddff&c=2&cu=0&fc=000000&gw=28&lc=ffffff&sh=cross&sp=111&sz=103',
        'v=1&as=38&ba=-180&bg=f5f5f5&cu=0&fc=1a1a1a&gw=19.5&lc=ffffff&sh=shield&so=0.11&sp=238&sz=105&tp=0.57'
      ],
      credit: {
        work: 'Fujisankei Kokukusha',
        designers: [
          { name: 'Ippo Miyamoto', url: 'https://logobook.com/designer/ippo-miyamoto/' },
          { name: 'Tadashi Ishikawa', url: 'https://logobook.com/designer/tadashi-ishikawa/' }
        ],
        year: 1978,
        url: 'https://logobook.com/logo/fujisankei-kokukusha/'
      },
      svg: ICONS.slicedShapes
    },
    {
      slug: 'slash-mark',
      name: 'Slash Mark',
      tagline: 'A containing shape striped with diagonals that match the ground.',
      blurb: 'Kazumasa Nagai\'s Minami-nihon broadcasting mark (1983) is a solid circle striped with diagonal cuts that match the background, so the slashes read as part of the field rather than lines on top.\n\nThe tool parameterizes this idea. Pick a base shape (circle, square, hexagon, or triangle), then set angle, count, line width, taper, and spread.',
      defaultSeed: '11',
      variants: [
        'v=1&a=135&bg=e3e3e3&ex=-1&lc=e3e3e3&n=9&sh=square&sp=26&tp=100',
        'v=1&a=90&bg=0d0d0d&ex=60&lc=0d0d0d&lw=26&n=5&sc=e4ff14&sh=hexagon&sp=86&tp=100',
        'v=1&a=91&bg=fbfaf8&ex=60&lc=fbfaf8&lw=24&n=5&sc=161812&sh=triangle&sp=78&sz=159&tp=100',
        'v=1&a=45&bg=fbf7e5&ex=60&lc=fbf7e5&lw=40&n=5&sc=454545&sp=100&tp=100'
      ],
      credit: {
        work: 'Minami-nihon',
        designers: [
          { name: 'Kazumasa Nagai', url: 'https://logobook.com/designer/kazumasa-nagai/' }
        ],
        year: 1983,
        url: 'https://logobook.com/logo/minami-nihon/'
      },
      svg: ICONS.slashMark
    },
    {
      slug: 'polygon-rosette',
      name: 'Polygon Rosette',
      tagline: 'Concentric polygons connected by diagonals — geometric rosettes.',
      blurb: 'The Grace jewelers mark (1982) nests an octagon inside an octagon and connects corresponding vertices, producing an internal star pattern that reads as a faceted gem.\n\nThe tool generalizes that to anything from three to twenty-four sides. A skip parameter controls which vertices connect — every value is a different rosette, and rotation rolls through them continuously.',
      defaultSeed: '6',
      variants: [
        'v=1&bg=ff4242&sw=18',
        'v=1&bg=1a1a1a&fg=ffffff&ir=0.1&n=14&r=261&sw=18',
        'v=1&bg=0e251b&fg=ffeedb&g=2.2&ir=0.5&n=3&r=260&rt=256&sk=1&sw=18',
        'v=1&bg=007bff&fg=ffffff&ir=0.3&n=4&r=262&rt=148&sw=30'
      ],
      credit: {
        work: 'Grace',
        designers: [
          { name: 'Koichi Nakai', url: 'https://logobook.com/designer/koichi-nakai/' },
          { name: 'Ichiro Nakai', url: 'https://logobook.com/designer/ichiro-nakai/' },
          { name: 'Tetsuo Hiro', url: 'https://logobook.com/designer/tetsuo-hiro/' },
          { name: 'Tetsuo Togasawa', url: 'https://logobook.com/designer/tetsuo-togasawa/' }
        ],
        year: 1982,
        url: 'https://logobook.com/logo/grace/'
      },
      svg: ICONS.polygonRosette
    },
    {
      slug: 'echo-stripes',
      name: 'Echo Stripes',
      tagline: 'Nested letters of horizontal stripes that thin out as they grow.',
      blurb: 'Tim Larsen\'s Bather Belrose Boje mark (1981) renders a letter as a core of thick stripes ringed by larger ghost copies in progressively thinner bars. The trick is alignment: every stripe sits at the same y, just thicker where the inner letter covers it.\n\nThe tool exposes growth ratio, thinning rate, and number of "echoes" so the cascade can hold or extend as far as you want.',
      defaultSeed: '1',
      variants: [
        'v=1&an=c&bg=1328c9&fg=ffffff&gr=1.47&rt=0.39&tk=90',
        'v=1&an=c&bg=280608&ch=J&fg=fffee0&gr=1.55&rt=0.57&st=20&tk=90',
        'v=1&ch=X&gr=1.55&rt=0.21',
        'v=1&an=c&bg=c913a7&ch=A&f=Audiowide&fg=ffffff&gr=2&lv=1&rt=0.25&sz=700&tk=65'
      ],
      credit: {
        work: 'Bather Belrose Boje',
        designers: [
          { name: 'Tim Larsen', url: null }
        ],
        year: 1981,
        url: null
      },
      svg: ICONS.echoStripes
    },
    {
      slug: 'dot-grid',
      name: 'Dot Grid',
      tagline: 'Letters bitmap-rendered from a rounded-rectangle dot grid.',
      blurb: 'Morton Goldsholl\'s LaSalle Steel mark (1962) renders a letter as a bitmap — a coarse grid of cells, each on or off depending on whether the letterform passes through it.\n\nThe tool follows the same approach and adds dot shape (circle, square, diamond, hexagon, triangle), grid density, and a corner radius. Pull the radius up and the cells read as dots; leave it at zero and they read as pixel blocks.',
      defaultSeed: '42',
      variants: [
        'v=1&bd=fcffe5&bg=000000&bs=circle&ch=X&dc=000000&ds=100&ff=Georgia&gc=22&ls=105&mg=7&oy=5&th=5',
        'v=1&bg=ffffff&dc=000000&ds=100&gc=7&ls=132&mg=5&ox=-3&oy=12&pa=0&th=9',
        'v=1&bd=85baff&bg=0f0449&ch=H&dc=17014b&ds=100&gc=13&ls=110&mg=4&oy=5&sh=hexagon&th=5',
        'v=1&bd=000000&bg=000000&ch=J&dc=d1ff52&ds=100&ff=Georgia&gc=20&ls=132&mg=5&oy=7&pa=0&sh=diamond&th=9'
      ],
      credit: {
        work: 'LaSalle Steel',
        designers: [
          { name: 'Morton Goldsholl', url: 'https://logobook.com/designer/morton-goldsholl/' }
        ],
        year: 1962,
        url: null
      },
      svg: ICONS.dotGrid
    }
  ];

  const INDEX_PATH = '/logo/';

  function toolPath(slug) { return INDEX_PATH + slug + '/'; }

  function findBySlug(slug) {
    return TOOLS.find(t => t.slug === slug) || null;
  }

  function currentIndex() {
    const parts = location.pathname.replace(/^\/|\/$/g, '').split('/');
    const i = parts.indexOf('logo');
    const slug = i >= 0 ? parts[i + 1] : parts[0];
    return TOOLS.findIndex(t => t.slug === slug);
  }

  window.LogoTools = {
    TOOLS: TOOLS,
    INDEX_PATH: INDEX_PATH,
    toolPath: toolPath,
    findBySlug: findBySlug,
    currentIndex: currentIndex
  };
})();
