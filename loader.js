(async () => {

  const mainScriptUrl = `https://wrongnumber.netlify.app/script/lms-ai-script.js`;
  const scriptContent = await fetch(mainScriptUrl).then(r => r.text());
  // Run the script
  eval(scriptContent);
})();

