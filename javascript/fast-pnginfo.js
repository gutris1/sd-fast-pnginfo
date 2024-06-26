fastPNGProcess = function () {
  document.querySelector("#fastpnginfo_submit").click();
  document.querySelector("#fastpnginfo_geninfo").style.visibility = "visible";
};

onUiLoaded(async function () {
  const app = gradioApp();
  if (!app || app === document) return;

  const img_input_el = app.querySelector("#fastpnginfo_image > div > div > input");
  const txt_output_el = app.querySelector("#fastpnginfo_geninfo  > label > textarea");
  const submit_el = app.querySelector("#fastpnginfo_submit");

  if (!img_input_el || !txt_output_el) return;

  img_input_el.addEventListener("change", fastpnginfo_process_image);

  submit_el.addEventListener("click", async function () {
    let img_el = app.querySelector("#fastpnginfo_image > div[data-testid='image'] > div > img");
    try {
      let response = await fetch(img_el.src);
      let img_blob = await response.blob();
      let arrayBuffer = await img_blob.arrayBuffer();
      let tags = ExifReader.load(arrayBuffer);

      if (tags) {
        let output = "";

        if (tags.parameters) {
          output = tags.parameters.description;
          
        } else if (tags.UserComment && tags.UserComment.value) {
          const ray = tags.UserComment.value;
          const result = [];
          var ar = ray;
          var pos = ar.indexOf(0) + 1;

          for(var i = pos; i < ar.length; i += 2) {
            var inDEX = ar[i];
            var nEXT = ar[i + 1];

            if(inDEX === 0 && nEXT === 32) {
              result.push(32);
              continue;
            }

            let vaLUE = inDEX * 256 + nEXT;
            result.push(vaLUE);
          }

          const userComment = new TextDecoder("utf-16").decode(new Uint16Array(result));
          output = userComment.trim().replace(/^UNICODE[\x00-\x20]*/, "");

        } else if (tags["Software"] && 
                   tags["Software"].description === "NovelAI" && 
                   tags.Comment && 
                   tags.Comment.description) {

          const nai = JSON.parse(tags.Comment.description);
          nai.sampler = "Euler";

          output = convertNAI(nai["prompt"])
            + "\nNegative prompt: " + convertNAI(nai["uc"])
            + "\nSteps: " + (nai["steps"])
            + ", Sampler: " + (nai["sampler"])
            + ", CFG scale: " + (parseFloat(nai["scale"]).toFixed(1))
            + ", Seed: " + (nai["seed"])
            + ", Size: " + (nai["width"]) + "x" + (nai["height"])
            + ", Clip skip: 2, ENSD: 31337";

        } else {
          output = "Nothing To See Here";
        }

        txt_output_el.value = output;
        txt_output_el.dispatchEvent(new Event("input", { bubbles: true }));
      }

      return tags;

    } finally {
      return app;
    }
  });

  async function fastpnginfo_process_image() {
    let img_el = app.querySelector("#fastpnginfo_image > div[data-testid='image'] > div > img");

    while (!img_el) {
      await new Promise(r => setTimeout(r, 100));
      img_el = app.querySelector("#fastpnginfo_image > div[data-testid='image'] > div > img");
    }

    await new Promise(r => setTimeout(r, 100));
  }
});

function round(v) { return Math.round(v * 10000) / 10000 }

function convertNAI(input) {
  const re_attention = /\{|\[|\}|\]|[^\{\}\[\]]+/gmu;
  let text = input.replaceAll("(", "\(").replaceAll(")", "\)").replace(/\\{2,}(\(|\))/gim, '\$1');
  let res = [], curly_brackets = [], square_brackets = [];
  const curly_bracket_multiplier = 1.05, square_bracket_multiplier = 1 / 1.05;
  function multiply_range(start, multiplier) {
    for (let pos = start; pos < res.length; pos++) res[pos][1] = round(res[pos][1] * multiplier);
  }
  for (const match of text.matchAll(re_attention)) {
    let word = match[0];
    if (word == "{") curly_brackets.push(res.length);
    else if (word == "[") square_brackets.push(res.length);
    else if (word == "}" && curly_brackets.length > 0) multiply_range(curly_brackets.pop(), curly_bracket_multiplier);
    else if (word == "]" && square_brackets.length > 0) multiply_range(square_brackets.pop(), square_bracket_multiplier);
    else res.push([word, 1.0]);
  }
  for (const pos of curly_brackets) multiply_range(pos, curly_bracket_multiplier);
  for (const pos of square_brackets) multiply_range(pos, square_bracket_multiplier);
  if (res.length == 0) res = [["", 1.0]];
  let i = 0;
  while (i + 1 < res.length) {
    if (res[i][1] == res[i + 1][1]) {
      res[i][0] += res[i + 1][0];
      res.splice(i + 1, 1);
    } else i++;
  }
  
  let result = "";
  for (let i = 0; i < res.length; i++) {
    if (res[i][1] == 1.0) result += res[i][0];
    else result += `(${res[i][0]}:${res[i][1]})`;
  }
  return result;
}

function plainTextToHTML(inputs) {
  var box = document.querySelector("#fastpnginfo_panel");
  var pr = `<b style="display: block; margin-bottom: 4px;">Prompt</b>`;
  var np = `<b style="display: block; margin-top: 15px; margin-bottom: 4px;">Negative Prompt</b>`;
  var pm = `<b style="display: block; margin-top: 15px; margin-bottom: 4px;">Params</b>`;
  var br = /\n/g;

  if (inputs === undefined || inputs === null || inputs.trim() === '') {
    box.style.opacity = '0';

  } else {
    if (inputs.includes("Nothing To See Here")) {
      pr = '';
    }

    box.style.opacity = '1';
    inputs = inputs.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(br, '<br>');
    inputs = inputs.replace(/Negative prompt:/, np).replace(/Steps:/, match => pm + match);                                
  }

  return `<div style="padding: 5px;">${pr}<p>${inputs}</p></div>`;
}
