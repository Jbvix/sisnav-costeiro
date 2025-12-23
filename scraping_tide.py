"""
Sistema de Coleta de Dados de Marés
Desenvolvido para extração automatizada de informações de tábua de marés
Author: Sistema de Navegação Marítima
Date: 2025-12-17
"""

import requests
from bs4 import BeautifulSoup
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timedelta
import re
import logging
from urllib.parse import urljoin

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class TideData:
    """Representa os dados de uma maré específica"""
    time: str
    height: float
    type: str  # 'preia-mar' ou 'baixa-mar'
    
    def __repr__(self):
        return f"{self.type.upper()}: {self.time} - {self.height}m"


@dataclass
class DailyTideInfo:
    """Informações completas de marés para um dia específico"""
    location: str
    date: str
    tides: List[TideData]
    coefficient: int
    sunrise: str
    sunset: str
    
    def get_high_tides(self) -> List[TideData]:
        """Retorna apenas as preamares"""
        return [tide for tide in self.tides if tide.type == 'preia-mar']
    
    def get_low_tides(self) -> List[TideData]:
        """Retorna apenas as baixa-mares"""
        return [tide for tide in self.tides if tide.type == 'baixa-mar']
    
    def get_tide_at_time(self, target_time: str) -> float:
        """
        Estima a altura da maré em um horário específico usando interpolação linear
        
        Args:
            target_time: Horário no formato "HH:MM"
            
        Returns:
            Altura estimada da maré em metros
        """
        target_minutes = self._time_to_minutes(target_time)
        
        # Encontrar as duas marés mais próximas
        before_tide = None
        after_tide = None
        
        for i, tide in enumerate(self.tides):
            tide_minutes = self._time_to_minutes(tide.time)
            
            if tide_minutes <= target_minutes:
                before_tide = tide
            elif tide_minutes > target_minutes and after_tide is None:
                after_tide = tide
                break
        
        if before_tide and after_tide:
            # Interpolação linear
            before_minutes = self._time_to_minutes(before_tide.time)
            after_minutes = self._time_to_minutes(after_tide.time)
            
            time_fraction = (target_minutes - before_minutes) / (after_minutes - before_minutes)
            estimated_height = before_tide.height + (after_tide.height - before_tide.height) * time_fraction
            
            return round(estimated_height, 2)
        
        return None
    
    @staticmethod
    def _time_to_minutes(time_str: str) -> int:
        """Converte horário HH:MM para minutos desde meia-noite"""
        hours, minutes = map(int, time_str.split(':'))
        return hours * 60 + minutes


class TideDataCollector:
    """Coletor principal de dados de marés"""
    
    BASE_URL = "https://tabuademares.com"
    
    def __init__(self, user_agent: str = None):
        """
        Inicializa o coletor de dados
        
        Args:
            user_agent: User agent customizado para as requisições
        """
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': user_agent or 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9',
        })
        
    def get_location_url(self, state: str, city: str) -> str:
        """
        Constrói a URL para uma localização específica
        
        Args:
            state: Estado (ex: 'ceara', 'rio-de-janeiro')
            city: Cidade (ex: 'fortaleza', 'rio-de-janeiro')
            
        Returns:
            URL completa da página de marés
        """
        # Normaliza os nomes para o formato da URL
        state_normalized = self._normalize_name(state)
        city_normalized = self._normalize_name(city)
        
        return f"{self.BASE_URL}/br/{state_normalized}/{city_normalized}"
    
    @staticmethod
    def _normalize_name(name: str) -> str:
        """Normaliza nomes para o formato de URL"""
        name = name.lower()
        name = name.replace(' ', '-')
        # Remove acentos
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
            'é': 'e', 'ê': 'e',
            'í': 'i',
            'ó': 'o', 'õ': 'o', 'ô': 'o',
            'ú': 'u', 'ü': 'u',
            'ç': 'c'
        }
        for old, new in replacements.items():
            name = name.replace(old, new)
        return name
    
    def collect_tide_data(self, state: str, city: str, date: datetime = None) -> Optional[DailyTideInfo]:
        """
        Coleta dados de marés para uma localização e data específicas
        
        Args:
            state: Estado
            city: Cidade
            date: Data desejada (padrão: hoje)
            
        Returns:
            DailyTideInfo com os dados coletados ou None em caso de erro
        """
        if date is None:
            date = datetime.now()
        
        url = self.get_location_url(state, city)
        
        try:
            logger.info(f"Coletando dados de {city}/{state} para {date.strftime('%d/%m/%Y')}")
            
            response = self.session.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extrair dados da tabela de marés
            tide_data = self._extract_tide_data(soup, date)
            
            if tide_data:
                logger.info(f"Dados coletados com sucesso: {len(tide_data.tides)} marés encontradas")
                return tide_data
            else:
                logger.warning(f"Nenhum dado encontrado para {city}/{state}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Erro na requisição HTTP: {e}")
            return None
        except Exception as e:
            logger.error(f"Erro ao processar dados: {e}")
            return None
    
    def _extract_tide_data(self, soup: BeautifulSoup, date: datetime) -> Optional[DailyTideInfo]:
        """
        Extrai dados de marés do HTML parseado
        
        Args:
            soup: Objeto BeautifulSoup com o HTML
            date: Data dos dados
            
        Returns:
            DailyTideInfo ou None
        """
        try:
            # Extrair nome da localização
            location_element = soup.find('h1')
            location = location_element.text.strip() if location_element else "Desconhecido"
            
            # Extrair dados da tabela
            table = soup.find('table')
            if not table:
                logger.warning("Tabela de marés não encontrada")
                return None
            
            # Encontrar a linha correspondente à data
            # Fix para Windows: %-d não funciona, usar str(date.day) remove zero à esquerda
            date_str = str(date.day) 
            rows = table.find_all('tr')
            
            logger.info(f"DEBUG: Searching for day '{date_str}' in {len(rows)} rows.")

            target_row = None
            for row in rows:
                first_cell = row.find('td')
                if first_cell:
                    txt = first_cell.text.strip()
                    # logger.info(f"DEBUG: Checking cell '{txt}'")
                    if date_str in txt:
                        target_row = row
                        logger.info(f"DEBUG: MATCH! Row found for {date_str}")
                        break
            
            if not target_row:
                logger.warning(f"Dados não encontrados para a data {date.strftime('%d/%m/%Y')}")
                return None
            
            # Extrair marés
            tides = []
            cells = target_row.find_all('td')
            
            # Padrão típico: célula com horário e altura
            # Padrão típico: célula com horário e altura (suporta virgula e ponto)
            tide_pattern = re.compile(r'(\d{1,2}:\d{2}).*?([\d.,]+)\s*m')
            
            for cell in cells:
                text = cell.get_text(" ", strip=True) 
                # logger.info(f"DEBUG: Regex checking text: '{text}'") 
                matches = tide_pattern.findall(text)
                if matches:
                    logger.info(f"DEBUG: Matches found: {matches}")
                
                for time, height in matches:
                    # Determinar tipo de maré baseado no contexto ou altura
                    tide_type = self._determine_tide_type(cell)
                    try:
                        normalized_height = float(height.replace(',', '.'))
                        tides.append(TideData(
                            time=time,
                            height=normalized_height,
                            type=tide_type
                        ))
                    except ValueError:
                        continue
            
            if not tides:
                 logger.error(f"DEBUG: Row found but NO tides extracted for {date_str}. Text: {target_row.get_text(strip=True)[:100]}")
            
            # Extrair coeficiente
            coefficient = self._extract_coefficient(target_row)
            
            # Extrair horários de nascer/pôr do sol
            sunrise, sunset = self._extract_sun_times(target_row)
            
            return DailyTideInfo(
                location=location,
                date=date.strftime("%d/%m/%Y"),
                tides=tides,
                coefficient=coefficient,
                sunrise=sunrise,
                sunset=sunset
            )
            
        except Exception as e:
            logger.error(f"Erro ao extrair dados: {e}")
            return None
    
    @staticmethod
    def _determine_tide_type(cell) -> str:
        """Determina se é preia-mar ou baixa-mar baseado no contexto"""
        # Implementação simplificada - pode ser melhorada
        # Verifica se há indicação de maré alta ou baixa no HTML
        text = cell.get_text().lower()
        if 'preia' in text or 'alta' in text:
            return 'preia-mar'
        elif 'baixa' in text:
            return 'baixa-mar'
        
        # Alternativa: usar classe CSS ou atributo
        if 'high' in cell.get('class', []) or 'preia' in str(cell):
            return 'preia-mar'
        return 'baixa-mar'
    
    @staticmethod
    def _extract_coefficient(row) -> int:
        """Extrai o coeficiente de maré da linha"""
        coef_pattern = re.compile(r'(\d{2,3})\s*(?:alto|médio|baixo|muito alto)')
        text = row.get_text()
        match = coef_pattern.search(text)
        return int(match.group(1)) if match else 0
    
    @staticmethod
    def _extract_sun_times(row) -> Tuple[str, str]:
        """Extrai horários de nascer e pôr do sol"""
        time_pattern = re.compile(r'(\d{1,2}:\d{2})')
        matches = time_pattern.findall(row.get_text())
        
        if len(matches) >= 2:
            return matches[0], matches[1]
        return "N/A", "N/A"


class TideDataProcessor:
    """Processa e analisa dados de marés"""
    
    @staticmethod
    def compare_locations(tide_data_list: List[DailyTideInfo]) -> Dict:
        """
        Compara dados de múltiplas localizações
        
        Args:
            tide_data_list: Lista de DailyTideInfo
            
        Returns:
            Dicionário com análises comparativas
        """
        comparison = {
            'locations': [data.location for data in tide_data_list],
            'max_tide_height': max(
                max(tide.height for tide in data.tides) 
                for data in tide_data_list
            ),
            'min_tide_height': min(
                min(tide.height for tide in data.tides) 
                for data in tide_data_list
            ),
            'avg_coefficient': sum(data.coefficient for data in tide_data_list) / len(tide_data_list)
        }
        
        return comparison
    
    @staticmethod
    def export_to_dict(tide_data: DailyTideInfo) -> Dict:
        """Exporta dados para dicionário JSON-serializável"""
        return {
            'location': tide_data.location,
            'date': tide_data.date,
            'coefficient': tide_data.coefficient,
            'sunrise': tide_data.sunrise,
            'sunset': tide_data.sunset,
            'tides': [
                {
                    'time': tide.time,
                    'height': tide.height,
                    'type': tide.type
                }
                for tide in tide_data.tides
            ],
            'high_tides': [
                {'time': tide.time, 'height': tide.height}
                for tide in tide_data.get_high_tides()
            ],
            'low_tides': [
                {'time': tide.time, 'height': tide.height}
                for tide in tide_data.get_low_tides()
            ]
        }


# ===== EXEMPLO DE USO =====

def main():
    """Exemplo de uso do sistema de coleta de dados"""
    
    # Inicializar coletor
    collector = TideDataCollector()
    
    # Data alvo
    target_date = datetime(2025, 12, 18)
    
    # Coletar dados de Fortaleza
    print("=" * 60)
    print("COLETANDO DADOS DE FORTALEZA")
    print("=" * 60)
    
    fortaleza_data = collector.collect_tide_data(
        state="Ceará",
        city="Fortaleza",
        date=target_date
    )
    
    if fortaleza_data:
        print(f"\n📍 Local: {fortaleza_data.location}")
        print(f"📅 Data: {fortaleza_data.date}")
        print(f"📊 Coeficiente: {fortaleza_data.coefficient}")
        print(f"🌅 Nascer do sol: {fortaleza_data.sunrise}")
        print(f"🌇 Pôr do sol: {fortaleza_data.sunset}")
        
        print("\n🌊 PREAMARES:")
        for tide in fortaleza_data.get_high_tides():
            print(f"  • {tide.time} - {tide.height}m")
        
        print("\n🌊 BAIXA-MARES:")
        for tide in fortaleza_data.get_low_tides():
            print(f"  • {tide.time} - {tide.height}m")
