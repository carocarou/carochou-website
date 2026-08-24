#!/usr/bin/env python3
# WARNING: once you start using the visual editor (editor/) to make real edits,
# do NOT re-run this script — it regenerates every .html file from the content
# hardcoded below and will overwrite any changes made through the editor.
# The .html files in the repo root are the source of truth from that point on.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate import page, project_nav, write

IMG = "assets/images"

# ---------------------------------------------------------------- index.html
body = f"""
<section class="hero container">
  <img src="{IMG}/home/Copy+of+collage.gif" alt="Animated collage of Caroline Chou's work">
  <p>Caroline Chou reimagines microbial community dynamics with the world around them.</p>
  <p>Her work focuses on cultivating relationships between community and science through interactive art rooted in storytelling.</p>
  <a class="see-more" href="work.html">See more &rarr;</a>
</section>
"""
write("index.html", page(
    "caroline chou",
    "Caroline Chou is a New York-based creative scientist working at the intersection of art and microbiology.",
    body,
))

# ---------------------------------------------------------------- work.html (overview)
overview_items = [
    ("work-microbes-musical.html", "microbes! the musical", f"{IMG}/work/waveinfiinty.gif"),
    ("work-within.html", "with(in)", f"{IMG}/work/IMG_5759.png"),
    ("work-bioremediation-game.html", "bioremediation game", f"{IMG}/work/Screenshot+2026-01-06+at+11.50.21_AM.png"),
    ("work-animatronics.html", "animatronics", f"{IMG}/work/file+(7).jpg"),
    ("work-mycelial-mat.html", "mycelial mat", f"{IMG}/work/Remove+background+project+(39).png"),
    ("work-paintings.html", "paintings", f"{IMG}/work/Screenshot+2026-01-06+at+12.00.53_PM.png"),
    ("work-film-photography.html", "film photography", f"{IMG}/work/img20240603_13572999.jpg"),
    ("work-community-projects.html", "community projects", f"{IMG}/work/Untitled+design+(10).jpg"),
    ("work-zines-prints.html", "zines + prints", f"{IMG}/work/SCAN0000_Page_2.jpg"),
    ("work-personal-projects.html", "personal projects", f"{IMG}/work/shrine1.jpg"),
]
grid = "\n".join(
    f'<a href="{href}"><img src="{src}" loading="lazy" alt="{label}"><span class="label">{label}</span></a>'
    for href, label, src in overview_items
)
body = f"""
<div class="page-header container">
  <h1>Selected Works</h1>
  <hr>
</div>
<div class="container">
  <div class="work-grid">
    {grid}
  </div>
</div>
"""
write("work.html", page(
    "Selected Works — caroline chou",
    "An overview of Caroline Chou's selected works spanning bio-art, community projects, painting, and more.",
    body,
))

# ---------------------------------------------------------------- work-within.html
body = f"""
<div class="project-header container">
  <h1>With(In)</h1>
  <div class="project-meta">Fabric, bioplastic, glass, wool, soil, <em>Cordyceps</em> mycelium, wood, plastic vinyl &middot; 2025</div>
</div>
<div class="project-media container">
  <div class="media-row">
    <img src="{IMG}/work_within/IMG_4377.JPG" alt="With(In) installation detail" loading="lazy">
    <img src="{IMG}/work_within/IMG_4355.jpg" alt="With(In) installation detail" loading="lazy">
  </div>
</div>
<div class="project-body container">
  <p>The piece explores <em>Cordyceps</em> fungi that grow inside insects, altering behavior and redistributing nutrients. The work reimagines these fungi's desire to reconnect with insect hosts, a cycle interrupted by human cultivation practices. The installation pumps mycelium into terrarium soil, challenging scientific frameworks by embracing contamination rather than isolation. Through interspecies collaboration, the work presents life and death as cyclical transformation.</p>
  <h3>Cordyceps Chicken Soup</h3>
  <p><strong>Ingredients:</strong> <em>Cordyceps militaris</em>, mushroom medley, chicken bones, ginger, water, shaoxing wine, salt, hot pot, soup ladle, bowl</p>
  <p>The soup contextualizes traditional Chinese medicine applications of Cordyceps for enhancing vital energy. The compound cordycepin offers anticancer, anti-inflammatory, and immune-modulating properties concentrated in the fungus's fruiting body. Death transitions into rebirth, continuing natural cycles.</p>
</div>
{project_nav("work-within.html")}
"""
write("work-within.html", page(
    "With(In) — caroline chou",
    "With(In): an installation exploring Cordyceps fungi, insect hosts, and cycles of life and death.",
    body,
))

# ---------------------------------------------------------------- work-microbes-musical.html
mm_dir = f"{IMG}/work_microbesmusical"
mm_files = [
    "20250321_NYU_Showcase_274.jpg",
    "Screenshot+2025-05-05+at+9.33.58_PM.png",
    "Screenshot+2025-05-05+at+9.35.56_PM.png",
    "Screenshot+2025-05-05+at+9.37.50_PM.png",
    "Screenshot+2025-05-05+at+9.39.04_PM.png",
    "Screenshot+2025-05-05+at+9.40.49_PM.png",
    "Screenshot+2025-05-05+at+9.43.11_PM.png",
    "Screenshot+2025-05-05+at+9.46.04_PM.png",
    "Screenshot+2025-05-05+at+9.47.02_PM.png",
    "Screenshot+2025-05-05+at+9.47.59_PM.png",
    "Screenshot+2025-05-05+at+9.49.04_PM.png",
    "Screenshot+2025-05-05+at+9.49.30_PM.png",
    "Screenshot+2025-05-05+at+10.00.02_PM.png",
    "1.png", "3.png", "4.png", "5.png", "6.png", "7.png", "8.png",
]
mm_grid = "\n".join(f'<img src="{mm_dir}/{f}" loading="lazy" alt="Microbes! The Musical production photo">' for f in mm_files)
body = f"""
<div class="project-header container">
  <h1>Microbes! The Musical</h1>
  <div class="project-meta">Writer, Director, Producer, Set &amp; Costume Designer, Marketing &amp; Communications<br>Marjorie S. Deane Little Theater, New York &middot; April 13, 2025</div>
</div>
<div class="project-body container">
  <p>"During the War Against Microbes, a spy is sent on a mission to gather intel about bacteria, the zombie-ant fungus, and insects to help a scientist develop technologies to eliminate the supposed enemy."</p>
  <p>Behind the scenes content available on Instagram <a href="https://www.instagram.com/microbesmusical" target="_blank" rel="noopener">@microbesmusical</a>.</p>
</div>
<div class="container">
  <div class="gallery-grid">
    {mm_grid}
  </div>
</div>
{project_nav("work-microbes-musical.html")}
"""
write("work-microbes-musical.html", page(
    "Microbes! The Musical — caroline chou",
    "Microbes! The Musical: an original musical staged at NYU exploring bacteria, fungi, and the war against microbes.",
    body,
))

# ---------------------------------------------------------------- work-mycelial-mat.html
body = f"""
<div class="project-header container">
  <h1>Mycelial Mat</h1>
  <div class="project-meta">Hemp chips, oyster mushroom mycelium, fabric scraps, turmeric, goji berries &middot; 28 x 18 x 5 cm &middot; 2024 &middot; Gallatin Arts Festival</div>
</div>
<div class="project-media container">
  <div class="media-row">
    <img src="{IMG}/work_mycelialmat/mat-1.jpg" alt="Mycelial Mat detail" loading="lazy">
    <img src="{IMG}/work_mycelialmat/mat-2.jpg" alt="Mycelial Mat detail" loading="lazy">
  </div>
</div>
<div class="project-body container">
  <p>Mycelium, the roots of mushrooms, provide essential nutrients that allow others around them to thrive. Most of Earth's soil contains mycelium networks supporting trees and plants while fostering biodiversity, yet these structures remain largely invisible to us.</p>
  <p>This interactive mat exposes mycelium, enabling deeper connection with subterranean ecosystems. The design draws from weaving patterns and <em>sashimono</em>, a traditional Japanese woodworking method that joins pieces without nails.</p>
  <p>A <a href="mycelial-mat-zine.html">zine</a> accompanies this work, documenting the creative process.</p>
</div>
{project_nav("work-mycelial-mat.html")}
"""
write("work-mycelial-mat.html", page(
    "Mycelial Mat — caroline chou",
    "Mycelial Mat: an interactive woven piece exposing mycelium networks, shown at the Gallatin Arts Festival.",
    body,
))

# ---------------------------------------------------------------- work-bioremediation-game.html
body = f"""
<div class="project-header container">
  <h1>Bioremediation Game</h1>
  <div class="project-meta">p5.js interactive simulation &middot; Henaff Lab</div>
</div>
<div class="project-media container">
  <img src="{IMG}/work_bioremediation-game/2024-04-26_TREE-GowanusCanalTeam+-+1.jpeg" alt="Gowanus Canal team" loading="lazy">
</div>
<div class="project-body container">
  <p>Created with p5.js, this interactive simulation bridges scientific research with the community by allowing those unfamiliar with bioremediation to engage with research underway at the Henaff Lab. Heavy-metal binding proteins are present in bacteria within the Gowanus Canal, a heavily contaminated waterway in Brooklyn, NY. By leveraging these proteins, a functional hydrogel can be developed to sequester contaminants such as lead, copper, and mercury.</p>
  <h3>How to play</h3>
  <p>You become the heavy-metal binding hydrogel that absorbs the lead in the Gowanus Canal. The game connects to your laptop's webcam, which tracks your hand movement. Lead is attracted to the hydrogel and can be removed when brought out of the water. If lead touches certain bacteria, they slow down; if it interacts with bacteria again, the bacteria die. Over time, the canal microbiome evolves with only lead-resistant bacteria (red) surviving.</p>
  <p><em>Note: this is a simplified simulation of evolution. There will not just be one resistant bacterium &mdash; there will be assemblages. Please allow at least 30 seconds for the game to load.</em></p>
</div>
{project_nav("work-bioremediation-game.html")}
"""
write("work-bioremediation-game.html", page(
    "Bioremediation Game — caroline chou",
    "An interactive p5.js simulation of bioremediation in the Gowanus Canal, built with the Henaff Lab.",
    body,
))

# ---------------------------------------------------------------- work-animatronics.html
body = f"""
<div class="project-header container">
  <h1>Animatronics</h1>
  <div class="project-meta">bringing the inanimate to life</div>
</div>
<div class="project-body container">
  <h3>Fungal Emergence</h3>
</div>
<div class="project-media container">
  <img src="{IMG}/work_animatronics/stabilized-ezgif.com-resize.gif" alt="Fungal Emergence animatronic" loading="lazy">
</div>
<div class="project-body container">
  <h3>Dragonbird</h3>
</div>
<div class="project-media container">
  <img src="{IMG}/work_animatronics/IMG_5776-vmake1-ezgif.com-gif-maker+(1).gif" alt="Dragonbird animatronic" loading="lazy">
</div>
{project_nav("work-animatronics.html")}
"""
write("work-animatronics.html", page(
    "Animatronics — caroline chou",
    "Animatronic sculptures bringing the inanimate to life: Fungal Emergence and Dragonbird.",
    body,
))

# ---------------------------------------------------------------- work-paintings.html
paintings = [
    ("Red Dragon", "red-dragon/file+(16).jpg", "Spray paint, acrylic paint, heritage cabinet door", "53 x 81 cm", "2020",
     "This artwork draws inspiration from classical Chinese painting traditions, merging historical artistic elements with contemporary methods. Created during the artist's preparation for relocating to Taiwan, the work functioned as “a tribute to the strength and resilience I was manifesting for my upcoming life transition.”"),
    ("Snake", "snake/Remove+background+project+(30).jpg", "Spray paint, acrylic, ink, heritage cabinet door", "96 x 54 cm", "2020",
     "During COVID-19's global upheaval, the artist found unexpected meaning in a Chinese painting-inspired work. The piece merges historical and contemporary elements alongside concepts of renewal and genesis. The pregnant serpent serves as a symbol of transitional moments and shifting priorities and values."),
    ("Regenesis", "regenesis/regenesis.jpg", "Pastel, calligraphy ink, found canvas", "198 x 97 cm", "2020",
     "The artist discovered an abandoned canvas on the street and transformed it. Working intuitively with color, the composition evolved into a serpentine form. The piece explores the tension between concealment and self-discovery, where “unraveling and exposing a darker inner world was the start of my return to my true self.”"),
    ("Big Cat", "big-cat/Remove+background+project+(14).jpg", "Watercolor, pastel, calligraphy ink, canvas cloth", "274 x 146 cm", "2020",
     "Made while quarantining in Taiwan at the start of the COVID-19 pandemic, this meditation-inspired work is based on 騷虞 (zouyu), a lesser-known creature from Chinese mythology resembling a tiger. Watercolors, blended with chalky pigment, vividly dyed the cloth as the artist set intentions before reconnecting with family in Taiwan &mdash; the zouyu symbolizing a search for peaceful resolutions during a turbulent time."),
    ("Orchid", "orchid/Remove+background+project+(27).png", "Oil, canvas cloth", "152 x 81 cm", "2023",
     "“Mother tended to her orchids / Though far from her native climate / Continued to bloom year after year.”"),
    ("Monstera", "plant/Remove+background+project+(18).png", "Oil, acrylic, pastel, watercolor, canvas cloth", "152 x 81 cm", "2022",
     "The artist followed the fabric's natural folds while creating the composition without a predetermined goal, building it incrementally. The work depicts the artist's mother's monstera plant."),
    ("Landscape", "landscape/93F8E8A5-C175-42BB-948A-A4A67E596C1D.jpg", "Calligraphy, ink, paper", "96 x 106 cm", "2021",
     "Calligraphy paintings from the artist's childhood provided “one of the few connections I had to my grandparents.” After moving in with her grandmother in Taiwan, she learned calligraphy and created this work as a gift for her grandmother."),
    ("It's Not Okay", "its-not-okay/Subject.jpg", "Ink, paper", "40 x 26 cm", "2019",
     "Created after attempting to help a high school student escape an abusive living situation. Despite efforts to navigate social welfare systems, nothing could be done since she was no longer a minor. “All forms of injustice are unacceptable and the responsibilities should not fall onto the individual when they are in danger.”"),
    ("Fractalization", "fractalization/Remove+background+project+(34).jpg", "Watercolor, calligraphy ink, ink, found watercolor scroll", "370 x 107 cm", "2019",
     "Made to visualize emotional patterns, discovering that depressive episodes followed cyclical rhythms: “ephemeral highs clouded my perception of how low the lows truly felt and how long they actually lasted.” The color progression &mdash; grey for disconnection, pink for grounding and brightness, then a return to somber blue &mdash; documents an emotional journey with “a fractal quality as they replicate patterns that are self-similar at different timescales.”"),
    ("Colors in Confinement", "color-in-confinement/Remove+background+project+(16).jpg", "Calligraphy ink, pastel, watercolor, canvas cloth", "165 x 115 cm", "2020",
     "Made while quarantining in Taiwan at the start of the COVID-19 pandemic, after experiencing a panic attack on the second day of a 14-day isolation. “The colors comforted me with every stroke as I cried and shed away my past hurt,” as anxiety “peaked, flooded through, and brought me to my knees” during those two weeks alone."),
    ("Amerikkka", "amerikkka/file+(18).jpg", "Acrylic paint, found American flag poster, broken wooden handle, duct tape", None, "2020",
     "“Land of the free, home of the brave.”"),
]
sections = []
for title, imgpath, medium, dims, date, desc in paintings:
    meta = medium
    if dims:
        meta += f" &middot; {dims}"
    meta += f" &middot; {date}"
    sections.append(f"""<div class="subwork">
  <h2>{title}</h2>
  <div class="project-meta">{meta}</div>
  <img src="{IMG}/{imgpath}" loading="lazy" alt="{title}">
  <div class="subwork-text"><p>{desc}</p></div>
</div>""")
body = f"""
<div class="page-header container">
  <h1>Paintings</h1>
  <hr>
</div>
{''.join(sections)}
{project_nav("work-paintings.html")}
"""
write("work-paintings.html", page(
    "Paintings — caroline chou",
    "A collection of paintings by Caroline Chou exploring identity, family, mental health, and Chinese painting traditions.",
    body,
))

# ---------------------------------------------------------------- work-film-photography.html
fp_dir = f"{IMG}/work_film-photography"
body = f"""
<div class="project-header container">
  <h1>Film Photography</h1>
  <div class="project-meta">Shot on Canon FTb-QL</div>
</div>
<div class="container">
  <div class="gallery-grid">
    <img src="{fp_dir}/000841150014.jpg" loading="lazy" alt="Film photograph">
    <img src="{fp_dir}/fish.jpg" loading="lazy" alt="Film photograph">
    <img src="{fp_dir}/img20240603_14110900.png" loading="lazy" alt="Film photograph">
  </div>
</div>
{project_nav("work-film-photography.html")}
"""
write("work-film-photography.html", page(
    "Film Photography — caroline chou",
    "Film photography by Caroline Chou, shot on a Canon FTb-QL.",
    body,
))

# ---------------------------------------------------------------- work-community-projects.html
body = f"""
<div class="page-header container">
  <h1>Community Projects</h1>
  <hr>
</div>
<div class="container">
  <div class="work-grid">
    <a href="roots-of-renewal.html"><img src="{IMG}/work_community-projects/D1A3D328-2984-433A-94CF-815255454ACD_1_105_c.jpg" loading="lazy" alt="Roots of Renewal"><span class="label">roots of renewal &middot; brooklyn, ny &middot; 2024</span></a>
    <a href="havenscourt-homestead.html"><img src="{IMG}/havenscourt-homestead/88A69BE5-a.jpg" loading="lazy" alt="Havenscourt Homestead"><span class="label">havenscourt homestead &middot; oakland, ca &middot; 2022</span></a>
  </div>
</div>
{project_nav("work-community-projects.html")}
"""
write("work-community-projects.html", page(
    "Community Projects — caroline chou",
    "Community-centered projects: Roots of Renewal and Havenscourt Homestead.",
    body,
))

# ---------------------------------------------------------------- roots-of-renewal.html
ror_dir = f"{IMG}/roots-of-renewal"
ror_files = [
    "IMG_1022.jpeg", "IMG_1033.jpeg", "IMG_1042.jpg", "IMG_1043.jpeg", "IMG_1056.jpeg",
    "IMG_3932.jpeg", "IMG_6950.JPG", "IMG_7289.JPG", "IMG_7293.JPG", "IMG_7304.JPG",
    "IMG_7305.JPG", "IMG_7613.JPG", "IMG_7624.JPG", "IMG_7652.JPG", "IMG_7663.JPG",
    "IMG_7673.jpg", "IMG_7677.JPG", "IMG_7685.JPG",
    "0A760803-76A4-4C64-BF8F-DAC4D09066C6.JPG", "176CC2D5-8F9C-4AB0-8185-88ECC7968980.JPG",
    "1C916465-BFC2-4A06-99DE-9CD899A09EFA.JPG", "2CEA7B2E-DAEB-4AEB-A396-56FC42AA415B.JPG",
    "3C8CD9E3-2D42-45DF-848F-B56FCE563323.JPG", "422477B2-6FFB-498D-8F86-A363E9AE30DC.JPG",
    "4AE25569-C179-4CBD-B4DD-6C8F8994E0C4.JPG", "4C6EBA3F-E3A0-447C-B339-BE203DA3D032.JPG",
    "5638DC9A-4AE8-4576-B8E1-1CEDA6005808.JPG", "599ADB1F-ED20-4A96-A3F0-C45E026DCACD.JPG",
    "93340F31-F46F-4E03-92B2-16B5B8F4C303.JPG", "ED39E897-B185-4A59-BFA3-1D3F43033374.JPG",
    "FDC84D8D-42DF-4DB3-98FE-46AFF996C00C.JPG",
]
ror_grid = "\n".join(f'<img src="{ror_dir}/{f}" loading="lazy" alt="Roots of Renewal">' for f in ror_files)
body = f"""
<div class="project-header container">
  <h1>Roots of Renewal</h1>
  <div class="project-meta">Sunset Park, Brooklyn, New York City &middot; 2024</div>
</div>
<div class="project-media container">
  <img src="{ror_dir}/ezgif.com-video-to-gif-converter.gif" alt="Roots of Renewal" loading="lazy">
</div>
<div class="project-body container">
  <p>Roots of Renewal was a five-week biodesign internship empowering Asian-American high school students by bringing together art, science, sustainability, and community care through the practice of building mycelium sculptures. This program connected youth to local communities, cultivated a curiosity for biodesign, and encouraged experimentation with science through creative expression.</p>
  <p>This program was made possible through collaborations with Chinese-American Planning Council, Genspace, New York Mycological Society, and funding from Asian American Art Alliance (A4)'s What Can We Do? grant.</p>

  <h3>Week 1 — Orientation</h3>
  <p>The first week was held at Genspace, a community biology lab in Sunset Park. Students learned about fungi, aseptic lab techniques, mushroom cloning, and activated their own mycelium using a Grow.bio Grow It Yourself kit. The internship launch concluded with a pizza celebration.</p>
  <p><em>"Starting off the week at Genspace was amazing. The resources were best — I discovered many community opportunities and felt empowered to continue my biology/design education." &mdash; Miya</em></p>

  <h3>Week 2 — Sustainability and Biomaterials</h3>
  <p>Week 2 occurred at ArtBuilt Studio, focusing on sustainability and biomaterials: a mycelium lecture, biodesigner panel discussion, sculpture brainstorming, prototyping, and packing mycelium.</p>
  <p><em>"My understanding of science, art, and design shifted — I now envision alternatives for everyday objects." &mdash; Nathaniel</em></p>

  <h3>Week 3 — Mushroom Walk</h3>
  <p>Interns explored Prospect Park with the New York Mycological Society, learning mushroom observation and identification, concluding with reflection and field journal sketching.</p>
  <p><em>"This internship gave me new perspective. Later, I returned to Prospect Park with my mother, sharing fungi knowledge from beneath dead logs." &mdash; Kevin</em></p>

  <h3>Week 4 — Mycelium Sculptures</h3>
  <p>Sessions included mushroom walk recaps, fungal DNA barcoding lectures, and group sculpture assembly. Students created individual pieces with accompanying narratives using various art materials.</p>
  <p><em>"I could potentially launch a company promoting affordable, well-known mycelium products." &mdash; Brian</em></p>

  <h3>Week 5 — Community Showcase</h3>
  <p>The final celebration featured student presentations, distribution of a field journal zine, and certificate awards.</p>
  <p><em>"I now comprehend mycelium's environmental significance in our daily lives." &mdash; Brian</em></p>
</div>
<div class="container">
  <div class="gallery-grid">
    {ror_grid}
  </div>
</div>
{project_nav("work-community-projects.html")}
"""
write("roots-of-renewal.html", page(
    "Roots of Renewal — caroline chou",
    "Roots of Renewal: a biodesign community internship for Asian-American youth in Sunset Park, Brooklyn.",
    body,
))

# ---------------------------------------------------------------- havenscourt-homestead.html
hh_dir = f"{IMG}/havenscourt-homestead"
hh_files = [
    "34A71D08-DC86-4354-AC07-ECFFF293D57C_1_105_c.jpg", "38EDA286-254E-4B47-AE78-4E77FE4249BD_1_105_c.jpeg",
    "4128FDF6-94F9-4D2A-9B2F-D5FA5898B40C_1_105_c.jpeg", "868C855D-C441-44B4-8E74-287DF0A3D9F7_1_105_c.jpeg",
    "88528DB8-657E-47AB-A2FF-B900BA267507_1_105_c.jpeg", "9C1B385B-642F-4359-AF03-C1E56214E204_1_105_c.jpg",
    "A7515A3D-80A2-41BC-A722-8B961C71851B_1_105_c.jpg", "B622C9DC-605F-46BE-916F-77F3C27BED70_1_105_c.jpeg",
    "DA4953CA-81EE-4770-AD10-24A9CB48EAA4_1_105_c.jpg", "F6AD17C7-BA8D-4EA1-BFE7-C800D7D61EF4_1_105_c.jpg",
    "FE1FF1C3-DAD2-407E-9124-D2C7163654B2_1_105_c.jpeg", "IMG_9091.jpg", "88A69BE5-b.jpg",
]
hh_grid = "\n".join(f'<img src="{hh_dir}/{f}" loading="lazy" alt="Havenscourt Homestead">' for f in hh_files)
body = f"""
<div class="project-header container">
  <h1>Havenscourt Homestead</h1>
  <div class="project-meta">Steel, acrylic paint, barrier tape, plastic leaves, plastic tags, plastic garden fence &middot; Oakland, CA &middot; 2022</div>
</div>
<div class="project-media container">
  <img src="{hh_dir}/88A69BE5-a.jpg" alt="Havenscourt Homestead installation" loading="lazy">
</div>
<div class="project-body container">
  <p>This traveling installation amplifies the voices of residents of the Havenscourt neighborhood in East Oakland to promote community-oriented social change and to create initiatives that improve the well-being of residents in the neighborhood.</p>
  <p>Over 200 residents participated in community conversations and expressed their passion, concerns, and dreams for their neighborhood into the installation. What was shared was then used in a community planning process to identify the new action plan priorities for the neighborhood collaborative.</p>
  <p><em>Havenscourt residents shared about their community's strengths, barriers, and hopes and dreams for their neighborhood specific to jobs and housing. Orange pertains to housing and yellow for jobs.</em></p>
</div>
<div class="container">
  <div class="gallery-grid">
    {hh_grid}
  </div>
</div>
{project_nav("work-community-projects.html")}
"""
write("havenscourt-homestead.html", page(
    "Havenscourt Homestead — caroline chou",
    "Havenscourt Homestead: a traveling community installation in East Oakland.",
    body,
))

# ---------------------------------------------------------------- work-zines-prints.html
body = f"""
<div class="page-header container">
  <h1>Zines + Prints</h1>
  <hr>
</div>
<div class="project-body container">
  <h3 style="text-align:center">Zines</h3>
</div>
<div class="container">
  <div class="work-grid">
    <a href="mycelial-mat-zine.html"><img src="{IMG}/mycelial-mat-zine/MycelialMatZinepng_Page_1.png" loading="lazy" alt="Mycelial Mat Zine"><span class="label">mycelial mat zine</span></a>
    <a href="ror-zine.html"><img src="{IMG}/ror-zine/SCAN0001_Page_1+2.jpg" loading="lazy" alt="Roots of Renewal Zine"><span class="label">roots of renewal zine</span></a>
    <a href="when-life-gets-you-down.html"><img src="{IMG}/when-life-gets-you-down/zine_Page_01.jpg" loading="lazy" alt="When Life Get's You Down"><span class="label">when life get's you down</span></a>
  </div>
</div>
<div class="project-body container">
  <h3 style="text-align:center">Linocut Prints</h3>
</div>
<div class="container">
  <div class="media-row" style="max-width:900px;margin:0 auto 60px;">
    <figure style="margin:0">
      <img src="{IMG}/work_zines-prints/SCAN0000_Page_2.jpg" loading="lazy" alt="By the Fireplace, 2018">
      <figcaption class="project-meta" style="text-align:center;margin-top:8px;">By the Fireplace, 2018</figcaption>
    </figure>
    <figure style="margin:0">
      <img src="{IMG}/work_zines-prints/SCAN0000_Page_1.jpg" loading="lazy" alt="Blue Room in 512, 2018">
      <figcaption class="project-meta" style="text-align:center;margin-top:8px;">Blue Room in 512, 2018</figcaption>
    </figure>
  </div>
</div>
{project_nav("work-zines-prints.html")}
"""
write("work-zines-prints.html", page(
    "Zines + Prints — caroline chou",
    "Zines and linocut prints by Caroline Chou.",
    body,
))

# ---------------------------------------------------------------- mycelial-mat-zine.html
mmz_dir = f"{IMG}/mycelial-mat-zine"
mmz_grid = "\n".join(f'<img src="{mmz_dir}/MycelialMatZinepng_Page_{i}.png" loading="lazy" alt="Mycelial Mat Zine page {i}">' for i in range(1, 8))
body = f"""
<div class="project-header container">
  <h1>Mycelial Mat Zine</h1>
  <div class="project-meta">Risograph &middot; Gallatin Arts Festival &middot; 2024</div>
</div>
<div class="project-body container">
  <p>This zine accompanies the <a href="work-mycelial-mat.html">Mycelial Mat</a> to tell a fuller story behind the process.</p>
</div>
<div class="container">
  <div class="gallery-grid">
    {mmz_grid}
  </div>
</div>
<div class="project-nav container" style="max-width:900px;">
  <a href="work-zines-prints.html">&larr; back to zines + prints</a>
</div>
"""
write("mycelial-mat-zine.html", page(
    "Mycelial Mat Zine — caroline chou",
    "A risograph zine documenting the process behind the Mycelial Mat.",
    body,
))

# ---------------------------------------------------------------- ror-zine.html
rz_dir = f"{IMG}/ror-zine"
rz_grid = "\n".join(f'<img src="{rz_dir}/SCAN0001_Page_{i}+2.jpg" loading="lazy" alt="Roots of Renewal Zine page {i}">' for i in range(1, 8))
body = f"""
<div class="project-header container">
  <h1>Roots of Renewal Zine</h1>
  <div class="project-meta">Risograph &middot; June 2024</div>
</div>
<div class="project-body container">
  <p>Made in collaboration with the interns from <a href="roots-of-renewal.html">Roots of Renewal</a>, this booklet is a collage of their field journal notes and drawings.</p>
</div>
<div class="container">
  <div class="gallery-grid">
    {rz_grid}
  </div>
</div>
<div class="project-nav container" style="max-width:900px;">
  <a href="work-zines-prints.html">&larr; back to zines + prints</a>
</div>
"""
write("ror-zine.html", page(
    "Roots of Renewal Zine — caroline chou",
    "A risograph zine collaging field journal notes and drawings from the Roots of Renewal interns.",
    body,
))

# ---------------------------------------------------------------- when-life-gets-you-down.html
wl_dir = f"{IMG}/when-life-gets-you-down"
wl_grid = "\n".join(f'<img src="{wl_dir}/zine_Page_{i:02d}.jpg" loading="lazy" alt="When Life Get&#39;s You Down page {i}">' for i in range(1, 17))
body = f"""
<div class="project-header container">
  <h1>When Life Get's You Down</h1>
  <div class="project-meta">Risograph &middot; San Francisco Zine Fest &middot; 2018</div>
</div>
<div class="project-body container">
  <p>As someone who struggles with chronic depression and anxiety, the artist created this interactive zine as a workbook for reframing mindsets learned while working in the field of community mental health. This zine is meant to be filled out like a journal, with guided reflection questions at the end.</p>
</div>
<div class="container">
  <div class="gallery-grid">
    {wl_grid}
  </div>
</div>
<div class="project-nav container" style="max-width:900px;">
  <a href="work-zines-prints.html">&larr; back to zines + prints</a>
</div>
"""
write("when-life-gets-you-down.html", page(
    "When Life Get's You Down — caroline chou",
    "An interactive risograph zine workbook for reframing mindsets around depression and anxiety.",
    body,
))

# ---------------------------------------------------------------- work-personal-projects.html
body = f"""
<div class="page-header container">
  <h1>Personal Projects</h1>
  <hr>
</div>
<div class="container">
  <div class="work-grid">
    <a href="crying-in-temples.html"><img src="{IMG}/work_personal-projects/psychadelictemple+(online-video-cutter.com).gif" loading="lazy" alt="Crying in Temples"><span class="label">crying in temples</span></a>
  </div>
  <p style="text-align:center;max-width:480px;margin:0 auto 60px;">A photo journal of my time in Taiwan from 2020-2022, making sense of family and grief</p>
</div>
{project_nav("work-personal-projects.html")}
"""
write("work-personal-projects.html", page(
    "Personal Projects — caroline chou",
    "Personal projects by Caroline Chou.",
    body,
))

# ---------------------------------------------------------------- crying-in-temples.html
cit_dir = f"{IMG}/crying-in-temples"

def poem(lines, align=None):
    style = ' style="text-align:right;"' if align == "right" else ""
    rows = "".join(f"<p{style}>{l}</p>" for l in lines)
    return f'<div class="poem"{style}>{rows}</div>'

def cit_img(fname, alt, wide=False):
    cls = ' style="max-width:640px"' if not wide else ""
    return f'<div class="project-media container"><img src="{cit_dir}/{fname}" loading="lazy" alt="{alt}"{cls}></div>'

body = f"""
<div class="project-header container">
  <h1>crying in temples</h1>
</div>
<div class="media-row container" style="max-width:900px;">
  <img src="{cit_dir}/gateorange.png" loading="lazy" alt="Orange temple gate">
  <img src="{cit_dir}/download1-ezgif.com-gif-maker.gif" loading="lazy" alt="Crying in Temples animation">
</div>
<div class="project-body container">
  {poem([
      "A place of solitude and communion",
      "companionship from snails and centipedes",
      "along side me as tears fell",
      "for the loss of my 阿媽 (grandma) and cousin,",
      "a childhood never shared,",
      "relationships never built,",
      "a language eroding over the years",
      "and a mother tongue never learned.",
  ])}
</div>
{cit_img("CopyofUntitledDesign-ezgif.com-loop-count.gif", "Crying in Temples animation")}
<div class="project-body container">
  <h3 style="text-align:center">taiwanese class</h3>
  {poem([
      "Li bhe kee",
      "Round nasal sounds",
      "Emerging deep from my core.",
      "Guttural tones that bring comforts",
      "without comprehension.",
      "The mothers&rsquo; voice",
      "Left at home, an ocean away.",
      "A dialect not learned from family",
      "But among peers in a classroom.",
      "Gua mah see",
      "Round nasal sounds",
      "As we repeat after the teacher",
      "Her tones reverberating in my throat",
      "Now suddenly have meaning.",
  ])}
</div>
{cit_img("Remove+background+project+(26).jpg", "Crying in Temples")}
<div class="project-body container">
  <h2 style="text-align:center">男重輕女</h2>
  <p style="text-align:center"><em>preference of sons over daughters</em></p>
</div>
<div class="media-row container" style="max-width:900px;">
  <img src="{cit_dir}/749_210320_11.jpg" loading="lazy" alt="Crying in Temples">
  <img src="{cit_dir}/door.png" loading="lazy" alt="Crying in Temples">
</div>
<div class="project-body container">
  {poem([
      "My grandfather arrives at heaven&rsquo;s gate",
      "bowing to our ancestors",
      "full of regret and despair.",
      "Empty handed,",
      "his accomplishments mean nothing",
      "after failing to produce a grandson,",
      "the 周 line ends with him.",
  ], align="right")}
</div>
{cit_img("Remove+background+project+(36).jpg", "Crying in Temples")}
<div class="project-body container">
  {poem([
      "As I sit at the dinner table,",
      "I look at my family,",
      "my family looks at their phones.",
      "I struggle to make sense of my place",
      "as the blue haired cousin",
      "who suddenly reappears,",
      "seeking a connection",
      "facing mutual disconnection.",
      "&ldquo;you&rsquo;re not what a daughter is expected to be&rdquo;",
  ])}
</div>
{cit_img("Remove+background+project+(38).jpg", "Crying in Temples")}
<div class="project-body container">
  {poem([
      "&ldquo;you dye your hair back to black or you don&rsquo;t come to the funeral&rdquo;",
      "A lifetime of separation",
      "dissipates,",
      "as we share our meals once again.",
  ])}
</div>
{cit_img("Untitled+design+(14).jpg", "Crying in Temples")}
<div class="project-body container">
  {poem([
      "你回來了",
      "I have returned.",
      "And festering anguish washes away.",
  ])}
</div>
{project_nav("work-personal-projects.html")}
"""
write("crying-in-temples.html", page(
    "crying in temples — caroline chou",
    "Crying in Temples: a poetic photo journal from Taiwan on family, grief, and language.",
    body,
))

# ---------------------------------------------------------------- about.html
body = f"""
<div class="page-header container">
  <h1>About</h1>
  <hr>
</div>
<div class="about-section container">
  <div class="about-images">
    <img src="{IMG}/about/Remove+background+project+(28).jpg" loading="lazy" alt="Caroline Chou portrait">
    <img src="{IMG}/about/IMG_3907.png" loading="lazy" alt="Caroline Chou at work">
    <img src="{IMG}/about/Remove+background+project+(40).png" loading="lazy" alt="Caroline Chou portrait">
  </div>
  <p>Caroline Chou is a New York-based creative scientist. Her research and artistic practice revolves around fungi-insect relations and chemical conversations.</p>
  <p>Not bound to a particular medium, Caroline's work is driven by interdisciplinary microbial research and their replenishing relationships to the world around them. She is currently an artist in residence at Genspace working closely with cordyceps and exploring themes around life and death, being/becoming, and traditional uses in Chinese medicine.</p>
  <p>Prior to this, she worked in community mental health, building collective resilience through art and storytelling.</p>
</div>
"""
write("about.html", page(
    "About — caroline chou",
    "About Caroline Chou, a New York-based creative scientist working at the intersection of fungi, insects, and art.",
    body,
))

# ---------------------------------------------------------------- cv.html
def cv_entry(title, meta):
    return f'<div class="cv-entry"><div class="cv-title">{title}</div><div class="cv-meta">{meta}</div></div>'

experience = [
    ("Graduate Researcher", "Hénaff Lab &middot; NYC &middot; 2023&ndash;Present"),
    ("MakeCode Consultant", "Friday &middot; Remote &middot; 2024"),
    ("Program Director", "Roots of Renewal &middot; NYC &middot; 2024"),
    ("Foodborne Disease Surveillance Intern", "NYC Dept. of Health &middot; 2024"),
    ("LGBTQIA Youth Mentor", "APICHA Community Health Center &middot; NYC &middot; 2023"),
    ("Lead Artist", "Healthy Havenscourt Collaborative &middot; Oakland &middot; 2022"),
    ("Project Coordinator", "East Bay Asian Local Development Corp &middot; Oakland &middot; 2022"),
    ("Community Engagement Lead", "Public Health Institute &middot; Oakland &middot; 2017&ndash;2020"),
]
education = [
    ("MA in Science Communication, Political Ecology", "NYU &middot; 2025 &mdash; Thesis: “Chemical Communication: An Evolutionary Dialogue Between Fungi, Bacteria, and Insects”"),
    ("BS in Microbial Biology", "UC Berkeley &middot; 2017"),
]
talks = [
    ("“Past Premonitions and Future Fossils”", "Genspace &middot; October 2025"),
    ("“Bioremediation with Heavy-metal-binding Hydrogels and Microbial Heritage Sites”", "What Around Design? 2024 &middot; Portugal &middot; October 2024"),
    ("“More-than-human Mapping: Microbial Heritage in Post-industrial Landscapes” (Poster)", "Spatial Humanities &middot; Germany &middot; September 2024"),
    ("“Roots of Renewal: Biodesign Community Program for AAPI Youth”", "Biodesign Symposium &middot; NYC &middot; June 2024"),
    ("“Biomaterials in Art”", "Gallatin Arts Festival &middot; NYC &middot; April 2024"),
    ("“Lifting the Voices of Asian Youth: Creating Youth Centered Emotional Wellness Support”", "Asian &amp; Pacific Islanders Mental Health Empowerment Conference &middot; California &middot; November 2019"),
]
awards = [
    ("Genspace Artist in Residence", "2025"),
    ("Horn Family Fund for Environmental Research", "2024 &amp; 2023"),
    ("Global Research Initiative Research Institute Fellow", "2024"),
    ("Asian American Art Alliance What Can We Do? Fellow", "2024"),
    ("Tandon Research Excellence Exhibit — 1st Place", "2024"),
    ("NYU Social Sector Leadership Diversity Fellow", "2023&ndash;2024"),
]
pubs = [
    ("Chou, C., Shih, H.-W., Sulich, K., Montclare, J., &amp; Hénaff, E. (2025).", "“Bioremediation with heavy-metal-binding hydrogels and microbial heritage sites.” In Mateus, A. (Ed.), <em>What's around design?</em> Springer Nature Singapore. (Forthcoming)"),
    ("Chou, C., Kong, S., &amp; Magdaraog, A. (2024).", "“Roots of renewal: Biodesign community program for AAPI youth.” <em>Research Directions: Biotechnology Design</em>. Cambridge University Press."),
]
exhibits = [
    ("Genspace Biomaterials Studio: Creation and Destruction", "September 2025"),
    ("Gallatin Masters Showcase", "June 2025 &amp; May 2024"),
    ("Gallatin Arts Festival", "April 2025 &amp; April 2024"),
    ("Microbes! The Musical", "April 13, 2025"),
    ("Healthy Havenscourt 2.0", "September 2022"),
]
skills = [
    ("Digital Fabrication", "CAD (Fusion 360), 3D printing, laser cutting, mold casting, Arduino"),
    ("Bioinformatics &amp; Data Analysis", "R, Python, molecular biology techniques, GIS"),
    ("Content Creation", "Adobe Creative Suite, Figma, Canva"),
    ("Art", "Oil painting, risoprinting, screenprinting, linoleum printing"),
    ("Community Engagement", "Relational project management, interdisciplinary collaboration, partnership development, event planning"),
]

def section(heading, entries):
    return f'<h2>{heading}</h2>' + "".join(cv_entry(t, m) for t, m in entries)

body = f"""
<div class="page-header container">
  <h1>Curriculum Vitae</h1>
  <hr>
</div>
<div class="cv-section container">
  {section("Experience", experience)}
  {section("Education", education)}
  {section("Conference Presentations &amp; Invited Talks", talks)}
  {section("Fellowships, Awards &amp; Grants", awards)}
  {section("Publications", pubs)}
  {section("Exhibits &amp; Performances", exhibits)}
  {section("Skills", skills)}
</div>
"""
write("cv.html", page(
    "CV — caroline chou",
    "Curriculum vitae for Caroline Chou: experience, education, talks, awards, publications, and skills.",
    body,
))

# ---------------------------------------------------------------- contact.html
body = f"""
<div class="contact-section container">
  <h1>Let's collaborate!</h1>
  <img src="{IMG}/contact/Screenshot+2024-03-14+at+3.29.21+PM.png" alt="Contact" loading="lazy">
  <p>Reach out about collaborations, commissions, exhibitions, or just to say hello.</p>
  <a class="contact-email" href="mailto:hello@carochou.com">hello@carochou.com</a>
  <div class="social-links">
    <a href="https://www.instagram.com/caroachou" target="_blank" rel="noopener">Instagram</a>
  </div>
</div>
"""
write("contact.html", page(
    "Contact — caroline chou",
    "Get in touch with Caroline Chou to collaborate, commission work, or say hello.",
    body,
))

print("\\nAll pages generated.")
