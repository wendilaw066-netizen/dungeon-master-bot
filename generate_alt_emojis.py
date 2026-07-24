import os
import time
import urllib.request
import urllib.parse
from PIL import Image
from rembg import remove

OUTPUT_DIR = "generated_emojis"
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

EMOJIS_TO_GENERATE = {
  # 1. Mata Uang & Sumber Daya (7)
  'res_coin': 'cute chibi gold coin stack, thick black outlines, flat vibrant colors, white background, vector art',
  'res_wood': 'cute chibi pile of brown logs, thick black outlines, flat vibrant colors, white background, vector art',
  'res_stone': 'cute chibi pile of grey stone rocks, thick black outlines, flat vibrant colors, white background, vector art',
  'res_iron': 'cute chibi silver iron ore with pickaxe, thick black outlines, flat vibrant colors, white background, vector art',
  'res_meat': 'cute chibi cartoon meat on bone, thick black outlines, flat vibrant colors, white background, vector art',
  'res_grain': 'cute chibi wheat grain bundle, thick black outlines, flat vibrant colors, white background, vector art',
  'res_mystic': 'cute chibi shiny purple gemstone, thick black outlines, flat vibrant colors, white background, vector art',
  
  # 2. Identitas Faksi & Wilayah (6)
  'fac_wei': 'cute chibi blue ancient chinese flag banner, thick black outlines, flat vibrant colors, white background, vector art',
  'fac_shu': 'cute chibi green ancient chinese flag banner, thick black outlines, flat vibrant colors, white background, vector art',
  'fac_wu': 'cute chibi red ancient chinese flag banner, thick black outlines, flat vibrant colors, white background, vector art',
  'fac_rebel': 'cute chibi black ancient chinese flag banner, thick black outlines, flat vibrant colors, white background, vector art',
  'map_town': 'cute chibi ancient chinese village town, thick black outlines, flat vibrant colors, white background, vector art',
  'map_capital': 'cute chibi grand ancient chinese palace, thick black outlines, flat vibrant colors, white background, vector art',
  
  # 3. Pasukan & Militer (8)
  'unit_infantry': 'cute chibi ancient chinese soldier with sword, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_archer': 'cute chibi ancient chinese archer with bow, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_cavalry': 'cute chibi ancient chinese soldier riding horse, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_spear': 'cute chibi ancient chinese spearman, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_catapult': 'cute chibi wooden catapult, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_merc': 'cute chibi ninja mercenary, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_special': 'cute chibi ancient chinese general, thick black outlines, flat vibrant colors, white background, vector art',
  'unit_spy': 'cute chibi mysterious spy in cloak, thick black outlines, flat vibrant colors, white background, vector art',
  
  # 4. Infrastruktur & Bangunan (11)
  'bld_farm': 'cute chibi rice paddy farm, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_quarry': 'cute chibi stone quarry mine, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_lumber': 'cute chibi lumberjack cabin, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_iron': 'cute chibi blacksmith forge, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_market': 'cute chibi merchant trade stall, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_warehouse': 'cute chibi wooden storage warehouse, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_barracks': 'cute chibi ancient chinese military tent, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_inn': 'cute chibi chinese tea house inn, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_harbour': 'cute chibi wooden harbor dock, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_school': 'cute chibi ancient scroll academy, thick black outlines, flat vibrant colors, white background, vector art',
  'bld_smithy': 'cute chibi anvil and hammer, thick black outlines, flat vibrant colors, white background, vector art',

  # 5. Status, Mekanik & Bencana (10)
  'stat_hunger': 'cute chibi empty rice bowl, thick black outlines, flat vibrant colors, white background, vector art',
  'stat_corrupt': 'cute chibi dirty gold coin bag, thick black outlines, flat vibrant colors, white background, vector art',
  'stat_trauma': 'cute chibi broken heart with bandaid, thick black outlines, flat vibrant colors, white background, vector art',
  'tech_gunpowder': 'cute chibi powder keg bomb, thick black outlines, flat vibrant colors, white background, vector art',
  'dis_blizzard': 'cute chibi frozen snowflake ice, thick black outlines, flat vibrant colors, white background, vector art',
  'dis_plague': 'cute chibi green poison cloud bottle, thick black outlines, flat vibrant colors, white background, vector art',
  'dis_drought': 'cute chibi cracked earth ground, thick black outlines, flat vibrant colors, white background, vector art',
  'act_march': 'cute chibi marching boots moving, thick black outlines, flat vibrant colors, white background, vector art',
  'act_siege': 'cute chibi flaming catapult projectile, thick black outlines, flat vibrant colors, white background, vector art',
  'act_trade': 'cute chibi camel carrying goods, thick black outlines, flat vibrant colors, white background, vector art',

  # 6. World Boss & Raid (3)
  'boss_lubu': 'cute chibi angry lu bu boss, thick black outlines, flat vibrant colors, white background, vector art',
  'boss_dongzhuo': 'cute chibi fat evil greedy warlord dong zhuo, thick black outlines, flat vibrant colors, white background, vector art',
  'boss_yellow': 'cute chibi yellow turban rebel mystic boss, thick black outlines, flat vibrant colors, white background, vector art',

  # 7. Tombol UI Bot (8)
  'btn_up': 'cute chibi green arrow up button, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_info': 'cute chibi blue info sign, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_report': 'cute chibi paper scroll report, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_shield': 'cute chibi wooden shield defense, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_refresh': 'cute chibi green refresh arrows, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_back': 'cute chibi red back arrow, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_confirm': 'cute chibi green checkmark yes, thick black outlines, flat vibrant colors, white background, vector art',
  'btn_cancel': 'cute chibi red cross no, thick black outlines, flat vibrant colors, white background, vector art',

  # --- KATEGORI 2: EKSPRESI KOMUNITAS ---
  # Sapaan & Kultur Gaming (10)
  'com_welcome': 'cute chibi character waving hello, thick black outlines, flat vibrant colors, white background, vector art',
  'com_bye': 'cute chibi character waving goodbye, thick black outlines, flat vibrant colors, white background, vector art',
  'com_gn': 'cute chibi character sleeping in bed zzz, thick black outlines, flat vibrant colors, white background, vector art',
  'com_gg': 'cute chibi character giving thumbs up, thick black outlines, flat vibrant colors, white background, vector art',
  'com_wp': 'cute chibi character clapping hands, thick black outlines, flat vibrant colors, white background, vector art',
  'com_glhf': 'cute chibi lucky four leaf clover, thick black outlines, flat vibrant colors, white background, vector art',
  'com_lfg': 'cute chibi character looking through spyglass, thick black outlines, flat vibrant colors, white background, vector art',
  'com_afk': 'cute chibi empty chair with zzz, thick black outlines, flat vibrant colors, white background, vector art',
  'com_mic': 'cute chibi studio microphone, thick black outlines, flat vibrant colors, white background, vector art',
  'com_stream': 'cute chibi video camera recording, thick black outlines, flat vibrant colors, white background, vector art',

  # Karakter & Meme Three Kingdoms (20)
  'meme_caocao_laugh': 'cute chibi cao cao laughing out loud, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_caocao_think': 'cute chibi cao cao rubbing chin thinking, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_caocao_angry': 'cute chibi cao cao angry steaming, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_caocao_shock': 'cute chibi cao cao shocked face dropping jaw, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_zhuge_fan': 'cute chibi zhuge liang holding feather fan, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_zhuge_sip': 'cute chibi zhuge liang sipping tea calmly, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_zhuge_sigh': 'cute chibi zhuge liang facepalming sighing, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_zhuge_smart': 'cute chibi zhuge liang with glasses nerd, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_lubu_rage': 'cute chibi lu bu super angry fire, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_lubu_flex': 'cute chibi lu bu flexing muscles, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_lubu_bored': 'cute chibi lu bu yawning bored, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_lubu_run': 'cute chibi lu bu running away fast dust, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_guanyu_sadge': 'cute chibi guan yu crying sad, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_guanyu_handshake': 'cute chibi two characters shaking hands firmly, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_guanyu_clap': 'cute chibi guan yu clapping proudly, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_guanyu_oof': 'cute chibi guan yu biting lip awkward oof, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_peon_panic': 'cute chibi ancient chinese peasant panicking, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_peon_salute': 'cute chibi ancient chinese peasant saluting enthusiastically, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_peon_f': 'cute chibi gravestone with flower, thick black outlines, flat vibrant colors, white background, vector art',
  'meme_peon_hype': 'cute chibi peasant partying with confetti, thick black outlines, flat vibrant colors, white background, vector art',

  # Role, Prestasi, dan Trofi (10)
  'rank_emperor': 'cute chibi golden imperial crown, thick black outlines, flat vibrant colors, white background, vector art',
  'rank_king': 'cute chibi silver crown, thick black outlines, flat vibrant colors, white background, vector art',
  'rank_duke': 'cute chibi bronze crown, thick black outlines, flat vibrant colors, white background, vector art',
  'mod_shield': 'cute chibi green mod shield with star, thick black outlines, flat vibrant colors, white background, vector art',
  'mod_ban': 'cute chibi ban hammer weapon, thick black outlines, flat vibrant colors, white background, vector art',
  'mod_warn': 'cute chibi yellow warning triangle sign, thick black outlines, flat vibrant colors, white background, vector art',
  'event_announce': 'cute chibi megaphone speaker shouting, thick black outlines, flat vibrant colors, white background, vector art',
  'event_giveaway': 'cute chibi gift box present wrapped, thick black outlines, flat vibrant colors, white background, vector art',
  'event_party': 'cute chibi party popper confetti, thick black outlines, flat vibrant colors, white background, vector art',
  'event_ticket': 'cute chibi golden entry ticket, thick black outlines, flat vibrant colors, white background, vector art',

  # Reaksi General & Menu Tambahan (7)
  'react_upvote': 'cute chibi green upward pointing arrow, thick black outlines, flat vibrant colors, white background, vector art',
  'react_downvote': 'cute chibi red downward pointing arrow, thick black outlines, flat vibrant colors, white background, vector art',
  'react_confused': 'cute chibi floating question mark, thick black outlines, flat vibrant colors, white background, vector art',
  'react_alert': 'cute chibi red exclamation mark warning, thick black outlines, flat vibrant colors, white background, vector art',
  'menu_1': 'cute chibi number one button, thick black outlines, flat vibrant colors, white background, vector art',
  'menu_2': 'cute chibi number two button, thick black outlines, flat vibrant colors, white background, vector art',
  'menu_rng': 'cute chibi red rolling dice, thick black outlines, flat vibrant colors, white background, vector art',
}

def download_and_process(key, prompt):
    print(f"Generating {key}...")
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=256&height=256&nologo=true&seed=888"
    
    raw_path = os.path.join(OUTPUT_DIR, f"{key}_raw.png")
    final_path = os.path.join(OUTPUT_DIR, f"{key}.png")
    
    if os.path.exists(final_path):
        print(f"Skipping {key}, already exists.")
        return
        
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(raw_path, 'wb') as out_file:
            out_file.write(response.read())
            
        img = Image.open(raw_path)
        out_img = remove(
            img,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=5
        )
        out_img.save(final_path)
        print(f"Finished {key}.")
        time.sleep(1.5)
    except Exception as e:
        print(f"Failed to process {key}: {e}")

for k, p in EMOJIS_TO_GENERATE.items():
    download_and_process(k, p)

print("All generation completed!")
