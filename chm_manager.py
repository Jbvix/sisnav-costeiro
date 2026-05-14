
import time
import logging
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# 配置 Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URLs das fontes
URLS_CHM = {
    'meteoromarinha': 'https://www.marinha.mil.br/chm/dados-do-smm-meteoromarinha/previsao-24-horas',
    'avisos_mau_tempo': 'https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo',
    'avisos_radio_norte': 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/norte',
    'avisos_radio_leste': 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/leste',
    'avisos_radio_sul': 'https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar/sul'
}

class CHMManager:
    def __init__(self):
        self.driver = None
        self.data = {}

    def _setup_driver(self):
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        try:
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.driver.set_page_load_timeout(30)
            return True
        except Exception as e:
            logger.error(f"Error setting up Chrome Driver: {e}")
            return False

    def _get_page_content(self, url):
        try:
            self.driver.get(url)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            time.sleep(2) # Wait for potential JS rendering
            return self.driver.page_source
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return None

    def _clean_text(self, html):
        if not html: return ""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for script in soup(['script', 'style', 'nav', 'header', 'footer']):
            script.decompose()
            
        # Try to target specific content areas if possible to reduce noise
        # This is generic, targeting the main content usually involves containers
        # For CHM sites, often the content is in a 'region-content' or similar
        content_div = soup.find('div', {'class': 'region-content'})
        if content_div:
            text = content_div.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
            
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)

    def fetch_all(self):
        if not self._setup_driver():
            return {'status': 'error', 'message': 'Failed to initialize browser'}

        try:
            results = {
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'meteo': None,
                'mau_tempo': None,
                'navarea': {
                    'norte': None,
                    'leste': None,
                    'sul': None
                }
            }

            # 1. Meteomarinha
            html = self._get_page_content(URLS_CHM['meteoromarinha'])
            results['meteo'] = self._clean_text(html)

            # 2. Mau Tempo (Metarea V)
            html = self._get_page_content(URLS_CHM['avisos_mau_tempo'])
            results['mau_tempo'] = self._clean_text(html)

            # 3. Navarea Regions
            for region in ['norte', 'leste', 'sul']:
                key = f'avisos_radio_{region}'
                html = self._get_page_content(URLS_CHM[key])
                results['navarea'][region] = self._clean_text(html)

            return {'status': 'success', 'data': results}

        except Exception as e:
            logger.error(f"Scraping error: {e}")
            return {'status': 'error', 'message': str(e)}
        finally:
            if self.driver:
                self.driver.quit()

def run_scrape():
    scraper = CHMManager()
    return scraper.fetch_all()
