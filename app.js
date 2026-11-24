const TEMPLATE_FILES = {
  home: 'mainTemplate.vue', radio: 'radioTemplate.vue', youtube: 'youtubeTemplate.vue',
  settings: 'settingsTemplate.vue', addons: 'addonsTemplate.vue', addon: 'addonTemplate.vue',
  addonView: 'addonView.vue', repository: 'repository.vue', images: 'imagesTemplate.vue',
  touch: 'touch.vue', click: 'click.vue', autoTouch: 'autoTouch.Click.vue',
  TV: 'TV.vue', radioGuide: 'radio.vue', music: 'musicTemplate.vue', tvGuide: 'tvTemplate.vue', channels: 'channelsTemplate.vue'
};
const NAV = [ ['home','⌂','Home'], ['images','▧','Images'], ['tvGuide','▣','TV'], ['radio','◉','Radio'], ['music','♫','Music'], ['youtube','▶','YouTube Videos'], ['addons','⊞','Addons'], ['settings','⚙','Settings'] ];
const ADDONS = [
  {id:'iptv_simple',name:'IPTV Simple Client',description:'Watch live TV from your own M3U playlist and EPG guide.',icon:'▣',version:'1.0.0'},
  {id:'iptv_manager',name:'IPTV Manager',description:'Manage IPTV clients and playlist integrations.',icon:'▤',version:'1.0.0'},
  {id:'youtube',name:'YouTube',description:'Browse videos, subscriptions and your YouTube profile.',icon:'▶',version:'1.0.0'},
  {id:'radio_browser',name:'Radio-Browser.info',description:'Discover radio stations from around the world.',icon:'◉',version:'1.0.0'},
  {id:'google_drive',name:'Google Drive',description:'Connect to cloud files using a one-time QR code.',icon:'△',version:'1.0.0'},
  {id:'onedrive',name:'OneDrive',description:'Connect to Microsoft cloud files using a one-time code.',icon:'☁',version:'1.0.0'}
];
function parseTemplate(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const tpl = doc.querySelector('template');
  if (!tpl) throw new Error('Vue template is missing its <template> element.');
  return tpl.innerHTML;
}
function readInstalled() { try { return JSON.parse(localStorage.getItem('lrf-installed') || '["youtube","radio_browser"]'); } catch { return ['youtube','radio_browser']; } }
function getRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash || hash === 'home') return {page:'home'};
  if (hash.startsWith('addon/')) {
    const bits = hash.split('/');
    const id = bits[1] || '';
    if (bits.includes('settings') || id === 'settings_youtube') return {page:'addonView', addonId:id === 'settings_youtube' ? 'youtube' : id, settings:true};
    if (id === 'iptv_manager' && bits.includes('redirect')) return {page:'addonView', addonId:'iptv_simple', settings:true};
    if (id === 'youtube' && bits[2] === 'subscriptions') return {page:'youtube', tab:'Subscriptions'};
    return {page:'addonView', addonId:id};
  }
  const key = hash.split(/[/?]/)[0];
  const aliases = {tv:'tvGuide',radio:'radio',music:'music',images:'images',addons:'addons',settings:'settings',repository:'repository',touch:'touch',click:'click',autoTouch:'autoTouch',channels:'channels'};
  return {page:aliases[key] || (TEMPLATE_FILES[key] ? key : 'home')};
}
async function start() {
  const templates = {};
  await Promise.all(Object.entries(TEMPLATE_FILES).map(async ([name,file]) => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Could not load ${file}`);
    templates[name] = parseTemplate(await response.text());
  }));
  const components = {};
  for (const [name,template] of Object.entries(templates)) {
    components[name] = { props:['state'], template, methods:{go(route){this.$emit('navigate',route)}, act(action,payload){this.$emit('action',action,payload)}} };
  }
  const app = Vue.createApp({
    template: templates.home,
    components,
    data(){ return { state:{nav:NAV,addons:ADDONS,installed:readInstalled(),stations:[],radioLoading:false,radioError:'',radioSearch:'',radioCategory:'',radioPage:'Trending',youtubeTab:'Trending',youtubeCode:'',youtubeProgress:0,youtubeLoading:false,m3uUrl:'',epgUrl:'',search:'',files:[],folders:[],mediaUrl:'',musicQuery:'',musicService:'Spotify',playlist:[],selectedAddon:'',toast:'',shutdown:false,volume:70,showPlayer:false}, route:getRoute() }; },
    computed:{ currentPage(){return this.route.page}, selectedAddonData(){return this.state.addons.find(a=>a.id===this.route.addonId)||this.state.addons[0]} },
    mounted(){ window.addEventListener('hashchange',this.onRoute); this.loadStations(); },
    beforeUnmount(){window.removeEventListener('hashchange',this.onRoute)},
    methods:{
      onRoute(){this.route=getRoute();if(this.route.page==='radio'&&!this.state.stations.length)this.loadStations();},
      navigate(route){if(typeof route==='string'&&route.startsWith('http')){window.open(route,'_blank','noopener');return;} location.hash=route==='home'?'home':route;this.onRoute();},
      goAddon(id,settings=false){this.navigate(`addon/${id}${settings?'/settings':''}`)},
      notify(message){this.state.toast=message;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.state.toast='',2800)},
      handleAction(action,payload){
        if(action==='install'||action==='remove'){const installed=new Set(this.state.installed);action==='install'?installed.add(payload):installed.delete(payload);this.state.installed=[...installed];localStorage.setItem('lrf-installed',JSON.stringify(this.state.installed));this.notify(action==='install'?'Add-on installed.':'Add-on removed.');}
        else if(action==='open-addon')this.goAddon(payload);
        else if(action==='addon-settings')this.goAddon(payload,true);
        else if(action==='search-radio'){this.state.radioSearch=payload||'';this.loadStations();}
        else if(action==='category'){this.state.radioCategory=payload;this.loadStations();}
        else if(action==='youtube-tab'){this.state.youtubeTab=payload;if(payload==='Sign In')this.navigate('addon/settings_youtube/signin');}
        else if(action==='youtube-connect')this.connectYoutube();
        else if(action==='save-iptv'){this.notify('IPTV settings saved on this device.');}
        else if(action==='signin-radio')this.navigate('https://radio-browser.info/my-profile/404');
        else if(action==='exit-radio')this.navigate('home');
        else if(action==='folder-select')this.chooseFiles(true);
        else if(action==='file-select')this.chooseFiles(false);
        else if(action==='play-radio')this.notify('Choose a station and press play in its audio player.');
        else if(action==='music-search')this.searchMusic(payload);
        else if(action==='power')this.state.shutdown=true;
        else if(action==='exit') { this.state.shutdown=false; this.navigate('home'); }
        else if(action==='report')this.notify('Thanks — station report form is not connected in this demo.');
        else if(action==='add-station')this.notify('Add a station by searching Radio-Browser.info.');
        else if(action==='youtube-signout'){this.state.youtubeTab='Trending';this.navigate('youtube');this.notify('Signed out of YouTube.');}
        else if(action==='drive')this.navigate(payload);
        else if(action==='add-playlist'){if(payload)this.state.playlist.push(payload);}
      },
      async loadStations(){
        this.state.radioLoading=true;this.state.radioError='';
        try{const params=new URLSearchParams({limit:'18',order:'clickcount',reverse:'true'});if(this.state.radioSearch)params.set('name',this.state.radioSearch);if(this.state.radioCategory)params.set('tag',this.state.radioCategory);const res=await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params}`);if(!res.ok)throw new Error('Radio directory unavailable');const data=await res.json();this.state.stations=data.filter(s=>s.url_resolved).slice(0,18);}
        catch(e){this.state.radioError='Radio directory could not be reached. Check your connection or try again.';this.state.stations=[];}finally{this.state.radioLoading=false;}
      },
      connectYoutube(){this.state.youtubeLoading=true;this.state.youtubeProgress=0;this.state.youtubeCode=Array.from({length:3},()=>Math.random().toString(36).slice(2,6).toUpperCase()).join('-');const link='https://www.google.com/device';window.open(link,'_blank','noopener');let p=0;const timer=setInterval(()=>{p=Math.min(100,p+10);this.state.youtubeProgress=p;if(p>=100){clearInterval(timer);this.state.youtubeLoading=false;this.notify('Demo connection ready — complete sign-in at google.com/device.');}},220);},
      chooseFiles(folders){const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='image/*,audio/*,video/*';if(folders)input.webkitdirectory=true;input.onchange=()=>{const chosen=Array.from(input.files||[]);if(folders&&chosen.length>5){this.notify('Please select up to five files/folders at a time.');return;}for(const file of chosen){const url=URL.createObjectURL(file);this.state.files.push({name:file.name,type:file.type,url});}if(folders)this.state.folders.push(...chosen.map(f=>f.webkitRelativePath.split('/')[0]).filter((v,i,a)=>a.indexOf(v)===i));};input.click();},
      searchMusic(query){this.state.musicQuery=query||'';if(!query){this.notify('Enter an artist, track or playlist to search.');return;}const q=encodeURIComponent(query);const urls={Spotify:`https://open.spotify.com/search/${q}`,'YouTube Music':`https://music.youtube.com/search?q=${q}`,'Tune-In':`https://tunein.com/search/?query=${q}`};this.state.mediaUrl=urls[this.state.musicService];this.state.showPlayer=true;}
    }
  });
  app.mount('#app');
}
start().catch(error=>{document.querySelector('#app').innerHTML=`<main class="main"><h1>Media Center could not start</h1><p>${error.message}. Make sure the template files are available from the same web server.</p></main>`;console.error(error);});
