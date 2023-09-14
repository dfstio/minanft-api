import { getT } from '../src/lang/lang'

async function main(): Promise<void> {
  const T = await getT('it')
  const msg: string = T('salutation')
  console.log(msg)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

