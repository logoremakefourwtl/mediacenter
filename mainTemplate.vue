<template>
  <section>
    <div class="hero"><div class="hero-copy"><span class="eyebrow">Your entertainment, together</span><h1>Welcome to your<br>Media Center.</h1><p>Discover live radio, browse your library and pick up right where you left off.</p><button class="button" @click="$emit('navigate','radio')">Explore radio <span aria-hidden="true">→</span></button></div></div>
    <div class="section-head"><div><span class="eyebrow">Make yourself at home</span><h2>Explore</h2></div><span class="muted">Everything in one place</span></div>
    <div class="grid"><button v-for="item in state.nav.slice(1,7)" :key="item[0]" class="tile" @click="$emit('navigate',item[0])"><div class="tile-icon">{{item[1]}}</div><strong>{{item[2]}}</strong><small>{{item[0]==='images'?'Your pictures and folders':item[0]==='tvGuide'?'Live TV and channels':item[0]==='radio'?'Stations from around the world':item[0]==='music'?'Search and play music':'Browse and manage add-ons'}}</small></button></div>
    <div class="section-head"><div><span class="eyebrow">Your setup</span><h2>Connected services</h2></div><button class="quiet" @click="$emit('navigate','addons')">Manage add-ons →</button></div>
    <div class="row"><span v-for="addon in state.addons.filter(a=>state.installed.includes(a.id)).slice(0,4)" :key="addon.id" class="callout">{{addon.icon}} &nbsp;{{addon.name}}</span><span v-if="!state.installed.length" class="muted">Install an add-on to get started.</span></div>
  </section>
</template>
