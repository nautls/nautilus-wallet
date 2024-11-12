import{_ as i,c as a,a1 as t,o as e}from"./chunks/framework.Ed-yv5-0.js";const c=JSON.parse('{"title":"Interacting with a wallet","description":"","frontmatter":{},"headers":[],"relativePath":"dapp-connector/wallet-interaction.md","filePath":"dapp-connector/wallet-interaction.md","lastUpdated":1731420630000}'),n={name:"dapp-connector/wallet-interaction.md"};function h(l,s,p,k,r,d){return e(),a("div",null,s[0]||(s[0]=[t(`<h1 id="interacting-with-a-wallet" tabindex="-1">Interacting with a wallet <a class="header-anchor" href="#interacting-with-a-wallet" aria-label="Permalink to &quot;Interacting with a wallet&quot;">​</a></h1><p>Once we gain access to the wallet, we can interact with it through the <a href="/dapp-connector/api-overview#context-api">Context API</a>. <a href="./wallet-connection#avoid-globally-instantiating-of-the-ergo-object">As explained earlier</a>, this API may or may not be globally injected into your dApp&#39;s context, depending on your implementation.</p><h2 id="get-balance" tabindex="-1">Get Balance <a class="header-anchor" href="#get-balance" aria-label="Permalink to &quot;Get Balance&quot;">​</a></h2><p>Let&#39;s start by getting the wallet&#39;s balance. To do this, use the <code>ergo.get_balance()</code> method.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> ergBalance</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_balance</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span></code></pre></div><p>By default the <code>get_balance()</code> method returns the ERG balance as a <code>string</code>, but parameters can be used to extend or refine the results.</p><div class="info custom-block"><p class="custom-block-title">INFO</p><p>To avoid data loss due to limitations of JavaScript&#39;s default JSON parser, please note that all amounts returned by the dApp Connector are encoded as <code>strings</code>, even though they represent <code>integers</code>. This ensures the accuracy and integrity of the data being processed.</p></div><h3 id="get-balance-by-token-id" tabindex="-1">Get Balance by <code>Token ID</code> <a class="header-anchor" href="#get-balance-by-token-id" aria-label="Permalink to &quot;Get Balance by \`Token ID\`&quot;">​</a></h3><p>You can pass a <code>Token ID</code> as the parameter of the <code>get_balance()</code> method to get the balance of a specific token.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sigUsdBalance</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_balance</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">  &quot;03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><h3 id="get-balance-for-all-assets" tabindex="-1">Get Balance for All Assets <a class="header-anchor" href="#get-balance-for-all-assets" aria-label="Permalink to &quot;Get Balance for All Assets&quot;">​</a></h3><p>To get the balance off all assets held by the connected wallet, pass the constant <code>all</code> as the parameter of the <code>get_balance()</code> method.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> fullBalance</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_balance</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;all&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">);</span></span></code></pre></div><p>The code above returns an <code>array</code> with the balance of all assets owned by the connected wallet, following this structure:</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{ </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">tokenId</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: string, </span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">balance</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: string }[];</span></span></code></pre></div><h2 id="get-addresses" tabindex="-1">Get Addresses <a class="header-anchor" href="#get-addresses" aria-label="Permalink to &quot;Get Addresses&quot;">​</a></h2><p>To retrieve wallet addresses, you can use the following methods:</p><ul><li><strong><code>ergo.get_change_address()</code></strong>: this method returns the wallet&#39;s primary address.</li><li><strong><code>ergo.get_used_addresses()</code></strong>: this method returns an <code>array</code> of used addresses.</li><li><strong><code>ergo.get_unused_addresses()</code></strong>: this method returns an <code>array</code> of unused addresses.</li></ul><h2 id="get-utxos" tabindex="-1">Get UTxOs <a class="header-anchor" href="#get-utxos" aria-label="Permalink to &quot;Get UTxOs&quot;">​</a></h2><p>You can use the <code>ergo.get_utxos()</code> method to fetch unspent UTxOs owned by the selected wallet.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> utxos</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_utxos</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span></code></pre></div><p>The code above returns an array of all UTxOs owned by the selected wallet.</p><h3 id="filter-utxos" tabindex="-1">Filter UTxOs <a class="header-anchor" href="#filter-utxos" aria-label="Permalink to &quot;Filter UTxOs&quot;">​</a></h3><p>The <code>get_utxos()</code> method supports filters by <code>Token ID</code> and <code>amount</code>. The code below fetches all UTxOs containing the SigUSD token.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sigUSDTokenId</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sigUsdUtxos</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_utxos</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ tokens: [{ tokenId: sigUSDTokenId }] }); </span></span></code></pre></div><p>If needed, a target amount can be specified, so that the wallet returns UTxOs until the target is met.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sigUSDTokenId</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sigUsdUtxos</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_utxos</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  tokens: [</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      tokenId: sigUSDTokenId,</span></span>
<span class="line has-focus"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      amount: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;100&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  ]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">});</span></span></code></pre></div><div class="tip custom-block"><p class="custom-block-title">TIP</p><p>Note that the <code>tokens</code> property is an <code>array</code>, which means you can filter by various tokens in the same call.</p></div><h2 id="get-the-current-height" tabindex="-1">Get the Current Height <a class="header-anchor" href="#get-the-current-height" aria-label="Permalink to &quot;Get the Current Height&quot;">​</a></h2><p>The current height stands for the latest block number included in the blockchain. This is necessary for transaction building.</p><p>You can make use of <code>ergo.get_current_height()</code> to get it.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> currentHeight</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_current_height</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span></code></pre></div><h2 id="sign-a-transaction" tabindex="-1">Sign a Transaction <a class="header-anchor" href="#sign-a-transaction" aria-label="Permalink to &quot;Sign a Transaction&quot;">​</a></h2><p>You can request a transaction signature by calling the <code>ergo.sign_tx()</code> method and passing an unsigned transaction object as parameter.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> unsignedTransaction</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> TransactionBuilder</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(currentHeight)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">from</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(inputs)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> OutputBuilder</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1000000</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">n</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, recipientAddress))</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">sendChangeTo</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(changeAddress)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">payMinFee</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">build</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  .</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">toEIP12Object</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> signedTransaction</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">sign_tx</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(unsignedTransaction); </span></span></code></pre></div><p>When <code>ergo.sign_tx()</code> is called, a pop-up window will be displayed to the user, asking them to review and sign the transaction. If the user signs it successfully, the method will return a signed transaction <code>object</code> that can be submitted to the blockchain. Otherwise, it will throw an exception.</p><div class="info custom-block"><p class="custom-block-title">INFO</p><p>As the focus of this guide is specifically on the <strong>dApp Connector</strong> protocol, we will not cover the details of the transaction-building process. For more information on transaction building, please refer to the <a href="https://fleet-sdk.github.io/docs/transaction-building" target="_blank" rel="noreferrer">Fleet SDK documentation</a>.</p></div><h3 id="submit-a-transaction" tabindex="-1">Submit a Transaction <a class="header-anchor" href="#submit-a-transaction" aria-label="Permalink to &quot;Submit a Transaction&quot;">​</a></h3><p>Now you have a signed transaction you can submit it to the blockchain using the <code>ergo.submit_tx()</code> method.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// ...</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> transactionId</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">submit_tx</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(signedTransaction);</span></span></code></pre></div><p>If the transaction is successfully accepted by the mempool, a <code>string</code> containing the <code>Transaction ID</code> will be returned otherwise, it will throw an exception.</p><h2 id="sign-arbitrary-data" tabindex="-1">Sign Arbitrary Data <a class="header-anchor" href="#sign-arbitrary-data" aria-label="Permalink to &quot;Sign Arbitrary Data&quot;">​</a></h2><p>Nautilus supports arbitrary data signing through the <code>ergo.sign_data()</code> method. This method takes two arguments to prompt the user for a signature:</p><ol><li><strong><code>address</code></strong>: The address from which the data should be signed.</li><li><strong><code>data</code></strong>: The data to be signed, which can be either a <code>string</code>, a <code>number</code>, a <code>JSON</code> object, or an <code>array</code> or them.</li></ol><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark has-focused-lines vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> address</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">get_change_address</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> data</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { foo: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;bar&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, baz: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> };</span></span>
<span class="line has-focus"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> proof</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ergo.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">sign_data</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(address, data); </span></span></code></pre></div><p>The code above asks Nautilus to prompt the user to review and sign the data. If the user signs it successfully, the method will return the signature proof as a hexadecimal <code>string</code> that can be further verified by a prover. Otherwise, it will throw an exception.</p><h3 id="verify-data-signature" tabindex="-1">Verify Data Signature <a class="header-anchor" href="#verify-data-signature" aria-label="Permalink to &quot;Verify Data Signature&quot;">​</a></h3><p>The <code>sign_data()</code> method uses the <a href="https://github.com/ergoplatform/eips/blob/master/eip-0044.md" target="_blank" rel="noreferrer">EIP-44</a> standard to sign arbitrary data. To verify signatures, you&#39;ll need a prover that supports this standard. Currently, only the <a href="https://github.com/fleet-sdk/fleet" target="_blank" rel="noreferrer">Fleet SDK</a> supports it. Below is an example of how you can verify a data signature generated by Nautilus.</p><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { Prover } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@fleet-sdk/wallet&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { ErgoAddress, ErgoMessage } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &quot;@fleet-sdk/core&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// ...</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> prover</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> Prover</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> data</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ErgoMessage.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">fromData</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ foo: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;bar&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, baz: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> });</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> [</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">publicKey</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">] </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ErgoAddress.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">decode</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(address).</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">getPublicKeys</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> verified</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> prover.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">verify</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(data, proof, publicKey);</span></span></code></pre></div><div class="info custom-block"><p class="custom-block-title">INFO</p><p>Note that the <code>address</code>, <code>data</code>, and <code>proof</code> must be the same as in the signing step.</p></div>`,50)]))}const g=i(n,[["render",h]]);export{c as __pageData,g as default};
