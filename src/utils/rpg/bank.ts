import { PlayerInventory, MinigameDB, saveMinigameDB } from '../minigame';

export function getLoanLimit(tier: number): number {
  if (tier === 1) return 50;
  if (tier === 2) return 500;
  if (tier === 3) return 5000;
  return 50;
}

export function handleBorrow(db: MinigameDB, player: PlayerInventory, amount: number): string {
  if (amount <= 0) return `Pinjam yang bener! Minimal 1 Coin.`;
  
  if (player.bank.debtToPay > 0) {
    return `⚠️ Lunasin dulu hutangmu sebesar **${player.bank.debtToPay} Coin** sebelum pinjam lagi! (Sisa waktu: ${Math.ceil((player.bank.deadline - Date.now()) / 3600000)} jam).`;
  }
  
  const limit = getLoanLimit(player.job.tier);
  if (amount > limit) {
    return `❌ Ditolak! Limit pinjaman maksimal untuk profesi **Tier ${player.job.tier}** adalah **${limit} Coin**.`;
  }
  
  const interest = Math.ceil(amount * 0.20); // 20% interest
  const totalDebt = amount + interest;
  
  player.coins += amount;
  player.bank = {
    loanAmount: amount,
    debtToPay: totalDebt,
    deadline: Date.now() + (24 * 60 * 60 * 1000) // 24 Hours
  };
  
  saveMinigameDB(db);
  
  return `🏦 **PINJAMAN DISETUJUI!**\nKamu menerima **${amount} Coin**.\n\n⚠️ **PERINGATAN:**\nTotal yang harus dikembalikan (`+`Bunga 20%): **${totalDebt} Coin**.\nBatas Waktu: **24 Jam**. Jika gagal membayar, akunmu akan **DIHAPUS TOTAL (WIPE OUT)**!`;
}

export function handleRepay(db: MinigameDB, player: PlayerInventory, amount: number): string {
  if (player.bank.debtToPay <= 0) {
    return `Kamu tidak punya hutang! Bersih dari riba.`;
  }
  
  if (amount <= 0) return `Bayar yang bener! Minimal 1 Coin.`;
  
  if (player.coins < amount) {
    return `Uangmu tidak cukup! Kamu mau bayar ${amount} Coin tapi cuma punya ${player.coins} Coin.`;
  }
  
  const payAmount = Math.min(amount, player.bank.debtToPay);
  
  player.coins -= payAmount;
  player.bank.debtToPay -= payAmount;
  
  saveMinigameDB(db);
  
  if (player.bank.debtToPay <= 0) {
    player.bank.deadline = 0;
    player.bank.loanAmount = 0;
    saveMinigameDB(db);
    return `🎉 **HUTANG LUNAS!** Kamu membayar ${payAmount} Coin. Terima kasih telah menggunakan layanan Bank Mafia!`;
  } else {
    return `💸 Kamu membayar ${payAmount} Coin. Sisa hutangmu sekarang: **${player.bank.debtToPay} Coin**. (Jangan lupa deadline!)`;
  }
}
