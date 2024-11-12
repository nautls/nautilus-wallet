import{_ as i,c as a,a1 as e,o as t}from"./chunks/framework.Ed-yv5-0.js";const d=JSON.parse('{"title":"Connecting to a Wallet","description":"","frontmatter":{},"headers":[],"relativePath":"dapp-connector/wallet-connection.md","filePath":"dapp-connector/wallet-connection.md","lastUpdated":1731325437000}'),n={name:"dapp-connector/wallet-connection.md"};function l(o,s,h,c,p,r){return t(),a("div",null,s[0]||(s[0]=[e(`<h1 id="connecting-to-a-wallet" tabindex="-1">Connecting to a Wallet <a class="header-anchor" href="#connecting-to-a-wallet" aria-label="Permalink to &quot;Connecting to a Wallet&quot;">​</a></h1><p>The first step in interacting with Nautilus is to request the access to the user. This is done using the <code>ergoConnector</code> object, which is automatically injected into the page context by the Nautilus Wallet web extension.</p><div class="warning custom-block"><p class="custom-block-title">WARNING</p><p><strong>Work-in-Progress</strong>: Non-reviewed text. You may find numerous writing errors throughout this guide.</p></div><h2 id="check-if-nautilus-is-running" tabindex="-1">Check if Nautilus is running <a class="header-anchor" href="#check-if-nautilus-is-running" aria-label="Permalink to &quot;Check if Nautilus is running&quot;">​</a></h2><p>To check if the user has the Nautilus Wallet installed and running, check for the presence of the <code>ergoConnector</code> and then for <code>ergoConnector.nautilus</code>.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (ergoConnector) { </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// check if the Connection API is injected</span></span>
<span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (ergoConnector.nautilus) { </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// check if the Nautilus Wallet is available</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Nautilus is ready to use&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">else</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Nautilus is not available&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">} </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">else</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;No wallet available&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h2 id="request-access" tabindex="-1">Request access <a class="header-anchor" href="#request-access" aria-label="Permalink to &quot;Request access&quot;">​</a></h2><p>After making sure that the Nautilus Wallet is installed and running, now it&#39;s time to request access to the user&#39;s wallet. This is done by calling the <code>ergoConnector.nautilus.connect()</code> method, as shown below.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> connected</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergoConnector.nautilus.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">connect</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(); </span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (connected) {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Connected!&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">} </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">else</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Not connected!&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><p>The first time the <code>connect()</code> method is called, Nautilus will pop up and prompt the user to allow or deny access to your dApp. By default, it will return <code>false</code> if the user declines, otherwise, it will return <code>true</code> and globally inject the <code>ergo</code> object which you can use to interact with the <a href="/dapp-connector/api-overview#context-api">Context API</a>. For the subsequent calls, if the dApp is previously, the Nautilus pop-up prompt will be bypassed.</p><h3 id="avoid-globally-instantiating-of-the-ergo-object" tabindex="-1">Avoid globally instantiating of the <code>ergo</code> object <a class="header-anchor" href="#avoid-globally-instantiating-of-the-ergo-object" aria-label="Permalink to &quot;Avoid globally instantiating of the \`ergo\` object&quot;">​</a></h3><p>Sometimes we need to avoid instantiating the <code>ergo</code> object globally, especially when handling multiple wallets. To achieve this, follow these steps:</p><ol><li>Call <code>ergoConnector.nautilus.connect({ createErgoObject: false })</code>. Calling the <code>connect()</code> method with the parameter <code>{ createErgoObject: false }</code> will request a connection with the user&#39;s wallet without automatically instantiating the <code>ergo</code> object.</li><li>Get the context object by calling the <code>ergoConnector.nautilus.getContext()</code> method.</li></ol><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> isConnected</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergoConnector.nautilus.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">connect</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ createErgoObject: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }); </span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (isConnected) {</span></span>
<span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> ergo</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergoConnector.nautilus.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">getContext</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(); </span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h3 id="check-for-authorization-and-connection-status" tabindex="-1">Check for authorization and connection status <a class="header-anchor" href="#check-for-authorization-and-connection-status" aria-label="Permalink to &quot;Check for authorization and connection status&quot;">​</a></h3><p>Nautilus provides methods to check both the authorization and connection status of your dApp with the wallet.</p><ul><li><code>ergoConnector.nautilus.isConnected()</code>: Checks if there is an active connection between your dApp and Nautilus.</li><li><code>ergoConnector.nautilus.isAuthorized()</code>: Checks if your dApp has been previously authorized by the user.</li></ul><h2 id="disconnect-from-the-wallet" tabindex="-1">Disconnect from the Wallet <a class="header-anchor" href="#disconnect-from-the-wallet" aria-label="Permalink to &quot;Disconnect from the Wallet&quot;">​</a></h2><p>You can disconnect from a wallet using the <code>ergoConnector.nautilus.disconnect()</code> method, which will revoke your dApp&#39;s authorization token. If you need to connect again in the future, the user will be prompted with a new connection request.</p>`,19)]))}const u=i(n,[["render",l]]);export{d as __pageData,u as default};
