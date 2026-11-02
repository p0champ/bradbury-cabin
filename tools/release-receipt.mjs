export function validateReceipt(receipt, {digest, commit, dirty, refs=[]}) {
  if(dirty)throw Error('Commit the exact checked files before publishing.');
  if(!receipt.allPassed || receipt.digest!==digest || receipt.commit!==commit)
    throw Error('Run npm run verify on the exact commit being published.');
  for(const ref of refs)if(ref.commit!==commit)throw Error('Pushed reference does not match the checked commit.');
}
