function injectIntoPage(code) {
  try {
    const container = document.head || document.documentElement;
    const scriptTag = document.createElement("script");
    scriptTag.setAttribute("async", "false");
    scriptTag.textContent = code;
    container.insertBefore(scriptTag, container.children[0]);
    container.removeChild(scriptTag);
    log("injection succeeded");
    return true;
  } catch (e) {
    error("injection failed: " + e);
    return false;
  }
}

function log(content) {
  console.log(`[Nautilus] ${content}`);
}

function error(content) {
  console.error(`[Nautilus] ${content}`);
}

const api = `
class ErgoApi {
  print() {
    console.log("this is a test.");
  }
}

const ergo = Object.freeze(new ErgoApi());
`;

injectIntoPage(api);
