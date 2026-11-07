// Palabras para "Palabras Espía" (lista propia, sustantivos comunes con varios sentidos).
const RAW = `
Abanico Abeja Abogado Aceite Aguja Águila Ala Alambre Alfombra Alga Alma Almohada Altavoz Ancla Anillo
Antena Araña Árbitro Arco Arena Armario Arpa Astronauta Ático Atlas Avión Azúcar Bala Ballena Banco
Bandera Bañera Barba Barco Barril Bastón Batería Baúl Bebé Biblioteca Bicicleta Bigote Billete Bolsa Bomba
Bombero Bombilla Bosque Bota Botella Botón Brújula Bruja Burbuja Caballo Cabeza Cable Cadena Café Caja
Cajero Calavera Calcetín Cama Cámara Camello Camino Campana Campo Canal Cangrejo Canguro Cañón Capa Capitán
Cara Caracol Carbón Cárcel Carta Casco Castillo Cebolla Cebra Cepillo Cerebro Cereza Cerradura Chaqueta Chocolate
Chispa Cielo Cine Cinta Cinturón Circo Cisne Ciudad Clavo Coche Cocina Cocodrilo Código Cohete Cola
Colegio Collar Columna Cometa Concierto Copa Corazón Corbata Corona Correo Cuchillo Cuello Cuerda Cuerno Cueva
Dado Delfín Desierto Diamante Diente Dinosaurio Disco Dragón Ducha Duende Eclipse Edificio Ejército Elefante Enano
Escalera Escoba Escudo Espada Espejo Espía Esponja Estación Estrella Estatua Fantasma Faro Fiesta Flecha Flor
Foca Fruta Fuego Fuente Gafas Gallina Gato Gigante Globo Gol Golpe Gorila Gorro Granada Granja
Grifo Guante Guerra Guitarra Gusano Hada Helado Hielo Hierba Hilo Hoja Hormiga Horno Hospital Hotel
Hueso Huevo Humo Iglesia Imán Isla Jabón Jardín Jaula Jefe Jirafa Joya Juego Juez Jugador
Ladrón Lago Lámpara Lana Lápiz Láser Lata Lazo Leche Lechuza León Letra Libro Licencia Limón
Línea Linterna Llama Llave Lluvia Lobo Loro Luna Lupa Madera Mago Maleta Mano Manta Manzana
Mapa Máquina Mar Marco Marea Mariposa Martillo Máscara Medalla Médico Mesa Metro Microscopio Miel Mina
Mono Montaña Mosca Moto Muela Muñeca Murciélago Museo Música Nariz Nave Nido Niebla Nieve Ninja
Noche Nota Nube Nudo Ojo Ola Olla Ópera Oreja Orquesta Oro Oso Oveja Pájaro Pala
Palacio Palma Pan Pantalla Papel Paracaídas Paraguas Pared Parque Pasta Pastel Pato Payaso Peine Película
Pelota Perro Pez Piano Pico Pie Piedra Piel Pila Piloto Pimienta Pino Pintura Pirámide Pirata
Pista Pizza Planeta Planta Plátano Plato Playa Pluma Policía Pollo Pozo Premio Príncipe Puente Puerta
Pulpo Punto Queso Radio Raíz Rana Rata Ratón Rayo Reina Reloj Red Regalo Rey Río
Robot Roca Rosa Rueda Sal Salsa Sartén Selva Semilla Serpiente Silla Sirena Sobre Sol Soldado
Sombra Sombrero Submarino Sueño Tabla Tambor Tanque Taxi Taza Teatro Teclado Teléfono Telescopio Templo Tenedor
Tiburón Tienda Tierra Tigre Tijeras Tinta Toalla Tomate Tormenta Toro Torre Tortuga Tren Trompeta Trono
Tubo Tumba Unicornio Uña Vaca Vampiro Vaso Vela Veneno Ventana Viento Vino Violín Volcán Zanahoria
Zapato Zorro Agente Banda Bar Bloque Bolsillo Calle Carrera Cubo Estrella Frente Gato Hoja Marcha
Masa Mando Muelle Onda Orden Palo Paso Planta Polo Puerto Ronda Serie Tapa Vuelo
`;

export const WORDS = [...new Set(RAW.split(/\s+/).filter(Boolean))];
