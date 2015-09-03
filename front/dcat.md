# DCAT

Vocabulario RDF definido para facilitar la interoperabilidad entre catálogos de datos
publicados por distintas fuentes.

De acuerdo a la documentación del estándar un catalogo de datos se apega al modelo DCAT si:
- Esta organizado por datasets y distribuciones
- Cuenta con descripciones RDF para si mismo y todos sus datasets y distribuciones
- Todas las clases y propiedades definidas en el estándar DCAT se utilizan en una forma
consistente con la semántica establecida en la especificación

### Conceptos Principales

- __Catalogo:__ Representa una colección de datasets

- __Dataset:__ Representa un conjunto de datos publicado como parte de un catalogo

- __Distribución:__ Representa una forma concreta de acceder a un dataset especifico,
algunos ejemplos son: archivo para descarga, formulario de solicitud, API


## BUDA + DCAT

Consideraciones para la primer integración de DCAT en la plataforma BUDA:

- Cada instancia de BUDA se encargará de manejar __un catalogo de datos__,
la información del catalogo podrá ser consultada mediante la URL: `/API_VERSION/catalog.json`
que devolverá una lista paginada de todos los datasets disponibles
- Cada __zona__ representa un dataset dentro del catalogo con una distribución por default,
el `accessURL` de esa distribución sera la URL utilizada para realizar consultas;
i.e. `BUDA_FRONT_ACCESS/API_VERSION/data.collection`

Algunos puntos importantes a discutir/diseñar en siguientes versiones son:

- Soporte para __multiples catálogos__ en una solo instancia
- Discutir si es necesario/deseable agregar un endpoint `catalog.xml` para distribuir la
información del catalogo en un documento XML
- Explorar la posibilidad de incorporar otros mecanismos de distribución, i.e;
archivos de descarga ( data dump ), streaming ( wss :heart_eyes: ), etc

Ejemplo para la distrubición de la información del catalogo:

```json
{
  "@type": "dcat:Catalog",
  "title": "Catalogo de Datos de la Red México Abierto",
  "description": "Colecciones de datos utilizadas para multiples proyectos de la Red",
  "dataset":
  [
    {
      "@type": "dcat:Dataset",
      "title": "Emergencias - Fondo Nacional de Desastres Naturales",
      "description": "Registros de Emergencias Naturales",
      "identifier": "fonden.emergencias",
      "keyword": ["fonden","desastres","emergencias"],
      "issued": "2015-08-01T12:44:03Z",
      "modified": "2015-09-03T11:14:26Z",
      "accessLevel": "public",
      "language": "es",
      "rights": "Información disponible para consulta publica",
      "license": "https://raw.githubusercontent.com/mxabierto/buda/master/LICENSE",
      "describedBy": "https://www.fonden.gob.mx/definitions.pdf",
      "describedByType": "application/pdf",
      "publisher":
      {
        "@type": "org:Organization",
        "name": "Fondo Nacional de Desastres Naturales"
      },
      "contactPoint":
      {
        "@type": "vcard:Contact",
        "fn": "Eduardo Clark",
        "hasEmail": "contacto@datos.gob.mx"
      },
      "distribution":
      [
        {
          "@type": "dcat:Distribution",
          "accessURL": "https://api.datos.gob.mx/v1/fonden.emergencias",
          "mediaType": "application/json"
        }
      ]
    }
  ]
}
```

### Namespaces utilizados en DCAT
- [dcat](http://www.w3.org/ns/dcat#)
- [dct](http://purl.org/dc/terms/)
- [dctype](http://purl.org/dc/dcmitype/)
- [foaf](http://xmlns.com/foaf/0.1/)
- [rdf](http://www.w3.org/1999/02/22-rdf-syntax-ns#)
- [rdfs](http://www.w3.org/2000/01/rdf-schema#)
- [skos](http://www.w3.org/2004/02/skos/core#)
- [vcard](http://www.w3.org/2006/vcard/ns#)
- [xsd](http://www.w3.org/2001/XMLSchema#)

### Referencias
- http://www.w3.org/TR/vocab-dcat/
- https://project-open-data.cio.gov/v1.1/schema/
- http://www.w3.org/TR/json-ld/
