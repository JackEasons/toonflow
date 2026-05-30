import generateRouter from "../src/core";

generateRouter().catch((error) => {
  console.error(error);
  process.exit(1);
});
