Y.use('node', 'squarespace-ui-base', function() {

  window.Site = Singleton.create({

    PARALLAX_FACTOR: 0.8, // eg: 80% of actual scroll
    SCROLL_SPEED: 0.6, // in seconds
    IMAGE_VIEWPORT: null, // exposed as tweak

    pageOffsets: {}, // cache pages' document position

    docHeight: 0,

    ready: function() {
      Y.on('domready', this.initialize, this);
    },

    initialize: function() {
      this.parallaxImages = Y.all('#parallax-images .image-container');
      this.parallaxPages = Y.all('.parallax-item');
      this.scrollEl = Y.one(Y.UA.gecko || Y.UA.ie || !!navigator.userAgent.match(/Trident.*rv.11\./) ? 'html' : 'body');
      this.viewportH = Y.one('body').get('winHeight');
      this.isMobile = !Y.Lang.isUndefined(window.orientation) || (Y.UA.ie > 0 && Y.UA.ie <= 9);

      this.bindUI();
      this.syncUI();

      if (Y.one('body.collection-type-index')) {
        this.handleIndex();
      }

      this.listenTweaks();

      Y.one('body').addClass('loaded');

      // Handle 
      if (Y.UA.ie) {
        Y.one('html').addClass('ie' + Y.UA.ie);
      }

      // Handle Win 8
      if (!this.isMobile) {
        Y.one('html').removeClass('touch');
      }
    },

    handleIndex: function() {
      // jump to hash url
      if (window.location.hash) {
        this.onHashChange({ 
          newHash: window.location.hash.replace('#', ''),
          quick: true 
        });
      } else {
        this.updateActivePage();
      }

      this.positionImages();
    },

    // all event handlers go here
    bindUI: function() {

      if (Y.one('body.collection-type-index')) {

        Y.one(Y.config.win).on('scroll', Y.throttle(Y.bind(function() {
          this.positionImages();
          this.updateActivePage();
        },this), 2), this);

        var resizeEvent = Y.UA.mobile ? 'orientationchange' : 'resize';
        Y.one(Y.config.win).on('resize', Y.throttle(Y.bind(function() {
          this.syncUI();
          this.positionImages();
        },this), 50), this);

        Y.on('hashchange', Y.bind(this.onHashChange,this), Y.config.win);

        Y.all('#parallax-nav a').each(function(link) {
          link.on('click', function() {
            if (link.getAttribute('href') === window.location.hash) {
              // force hash update
              this.onHashChange({ 
                newHash: link.getAttribute('href').replace('#', '')
              });
            }
          }, this);
        }, this);

        Y.one('.back-to-top-link a').on('click', function(e) {
          e.halt();
          this.onHashChange({
            newHash: Y.one('[data-url-id]').getAttribute('data-url-id')
          });
        }, this);

        Y.all('#desktopNav .external-link a[href*=#]').each(function(link) {
          link.on('click', function(e) {
            var target = Y.one(link.getAttribute('href'));
            if (target) {
              var targetY = target.getXY()[1];
              e.preventDefault();

              this.autoScrolling = true;
              this.scrollEl.anim({}, {
                to: { scroll: [0, targetY ] },
                duration: this.SCROLL_SPEED,
                easing: Y.Easing.easeBoth
              }).run().on('end', function() {
                if(this.scrollEl.get('scrollTop') !== targetY) {
                  this.scrollEl.set('scrollTop', targetY);
                }
                this.autoScrolling = false;
                this.updateActivePage();
              }, this);
            }
          }, this);
        }, this);

      } else {

        Y.one(Y.config.win).on('scroll', Y.bind(function() {
          this.positionBackgroundImage();
        },this), this);        

        var resizeEvent = Y.UA.mobile ? 'orientationchange' : 'resize';
        Y.one(Y.config.win).on(resizeEvent, Y.throttle(Y.bind(function() {
          this.syncUI();
          this.positionBackgroundImage();
        },this), 50), this);          

      }

      this.setupMobileNav();

    },

    // put things you'd like to happen on init and window resize here
    syncUI: function() {

      var $body = Y.one('body');
      var headerHeight = Y.one('#header').height();
      var titlePadding = 80; // wish there was an easier way to get this
      var bFixedHeader = $body.hasClass('fixed-header');
      var bTitleOverImage = $body.hasClass('title--description-position-over-image');

      this.parallaxOff = Y.Squarespace.Template.getTweakValue('parallax-scrolling') == 'false';

      this.viewportH = $body.get('winHeight');
      this.docHeight = $body.get('docHeight');


      if (Y.one('body.collection-type-index')) {

        if (this.isMobile) {
          this.setupMobileLayout();
          Y.one('#header').setStyle('position', 'absolute');
          Y.one('.sqs-cart-dropzone').setStyle('marginTop', headerHeight);
          if (Y.one('.parallax-images > .image-container:nth-child(1) > img')) {
            Y.one('.title-desc-wrapper').setStyle('minHeight', '600px');
          }
          Y.one('.title-desc-wrapper').setStyle('paddingTop', headerHeight);
        } else {
          Y.one('#content-wrapper').setStyle('marginTop', bFixedHeader ? headerHeight : null);
          // add extra padding to all items
          Y.all('.title-desc-wrapper').setStyle('paddingTop', bFixedHeader && bTitleOverImage ? titlePadding + headerHeight : null);
          // remove extra padding from first
          Y.one('.title-desc-wrapper') && Y.one('.title-desc-wrapper').setStyle('paddingTop', null); 
        }

        var imageHeightTweak = Y.Squarespace.Template.getTweakValue('index-image-height');
        if (imageHeightTweak == 'Fullscreen') {
          this.IMAGE_VIEWPORT = 1;
        } else if (imageHeightTweak == 'Half') {
          this.IMAGE_VIEWPORT = 0.5;
        } else {
          this.IMAGE_VIEWPORT = 0.66;
        }

        // First image same height as others, or fullscreen
        this.firstImageHeight = Y.Squarespace.Template.getTweakValue('first-index-image-fullscreen') === 'true' ? this.viewportH : parseInt(this.viewportH * this.IMAGE_VIEWPORT);
        this.restImageHeight = parseInt(this.viewportH * this.IMAGE_VIEWPORT);

        var imgs = new Y.NodeList();
        this.parallaxPages.each(function(page,i) {

          if (!this.isMobile) {

            // Set image foreground equal to viewport
            var imageH = i === 0 ? this.firstImageHeight - Y.one('#header').height() : this.restImageHeight;

            // handle short viewports
            if (bTitleOverImage) {
              var effectivePadding = bFixedHeader ? headerHeight + titlePadding*2 : titlePadding*2;
              imageH = Math.max(imageH, page.one('.title-desc-inner').height() + effectivePadding);  
              
              // make image container tall enough to account for title-desc-wrapper height
              var imageContainerH = i === 0 ? imageH + headerHeight : imageH;
              this.parallaxImages.item(i).setStyle('height', Math.max(this.viewportH, imageContainerH) + 'px');
            }

            var img = this.parallaxImages.item(i).one('img');
            if (img) {
              page.one('.title-desc-wrapper').setStyle('height', imageH + 'px');
              imgs.push(img.removeAttribute('data-load'));
            }
          }

          // Update cache
          this.pageOffsets[page.getAttribute('data-url-id')] = i === 0 ? 0 : Math.round(page.getXY()[1]);
        }, this);
        Y.Squarespace.GalleryManager.addImageQueue(imgs);

        // refresh image state
        this.parallaxImages.each(function(imgWrapper, i) {
          var img = imgWrapper.one('img'); 
          if(!img) { return; }

          if (img.getAttribute('src')) {
            ImageLoader.load(img);
          }
        }, this);

      } else {
        var img = Y.one('.banner-image img');
        img && ImageLoader.load(img);

        Y.one('.sqs-cart-dropzone').setStyle('marginTop', headerHeight);

        if (!this.isMobile) {  
          Y.one('#header-wrapper').setStyle('paddingTop', bFixedHeader ? headerHeight : null);
        }
      }

      // center collection title
      if ( !this.isMobile /*&& !(Y.UA.ie > 0 && Y.UA.ie <= 9)*/ ) {
        if (Y.one('.collection-type-index.title--description-alignment-center.title--description-position-over-image')) {
          Y.all('.title-desc-wrapper.has-main-image').each( function(n) {
            n.one('.title-desc-inner').setStyles({
              top: '50%',
              left: '50%',
              marginTop: -0.5 * this.one('.title-desc-inner').get('offsetHeight') + 'px',
              marginLeft: -0.5 * this.one('.title-desc-inner').get('offsetWidth') + 'px'
            });
          });
        }

        // sets collection title/desc under header in top left position
        if (Y.one('.collection-type-index.title--description-alignment-left')) {
          Y.all('.title-desc-wrapper.over-image.has-main-image .title-desc-inner').setStyles({
            top: null,
            left: null,
            marginTop: null,
            marginLeft: null
          });
        }

        if (Y.one('#parallax-nav')) {
          var parallaxNavHeight = Y.one('#parallax-nav').get('offsetHeight');
          Y.one('#parallax-nav').setStyle('marginTop', (-1 * (parallaxNavHeight / 2)));
        }
      }

      // check for emtpy footer 
      if (!Y.one('.footer-wrapper .sqs-block')) {
        Y.one('.footer-wrapper').addClass('empty');
      }

      // check for nav, hide menu icon if none
      if (Y.one('.nav-wrapper')) {
        $body.addClass('has-nav');
      }

      // shrink on blog and event titles in list view
      Y.all('.collection-type-events.view-list .entry-title-wrapper h1.entry-title').plug(Y.Squarespace.TextShrink);

      Y.all('.page-title').plug(Y.Squarespace.TextShrink, {
        parentEl: Y.one('.title-desc-wrapper')
      });

      Y.all('.collection-type-blog.view-list.blog-layout-columns .entry-title-wrapper h1.entry-title').plug(Y.Squarespace.TextShrink);

    },

    setupMobileLayout: function () {

      /* Calculate the imageHeight. */
      var viewportHeight = Y.config.win.innerHeight > Y.config.win.innerWidth ? screen.height : screen.width;
      var imageHeight = Y.Squarespace.Template.getTweakValue('index-image-height');

      if (imageHeight == 'Two Thirds') {
        imageHeight = 0.66666;
      } else {
        if (imageHeight == 'Fullscreen') {
          imageHeight = 1;
        } else {
          imageHeight = 0.5;
        }
      }
      imageHeight = imageHeight * viewportHeight;

      Y.all('.parallax-item').each(function (item, i) {
    
        var wrapper = item.one('.title-desc-wrapper');
        var inner = item.one('.title-desc-inner');

        
          wrapper.setStyle(
            'minHeight', imageHeight
          );

        if (Y.one('.title--description-alignment-center')) {
          if (inner.get('clientHeight') < wrapper.get('clientHeight') && i !== 0) {
            inner.setStyles({
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translatex(-50%) translatey(-50%)'
            });
          } else {
            inner.setStyles({
              position: 'relative'
            });
          }

          if (i === 0) {
            if (inner.get('clientHeight') + 78 < wrapper.get('clientHeight') - this.headerHeight) {
              item.one('.title-desc-inner').setStyle(
                'paddingTop', Y.one('#header').get('clientHeight') + 78
              );

              inner.setStyles({
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translatex(-50%) translatey(-50%)'
              });
            } else {
              inner.setStyles({
                position: 'relative',
                marginBottom: '78px'
              });
            }
          }
        }
        
      });


      if (!Y.one('.parallax-scrolling')) {

        Y.one('body').addClass('mobile-no-parallax');

        Y.all('.title-desc-image').each(function (image, i) {
          if (i === 0) {
            image.setStyles({
              // paddingTop: Y.one('#header').get('clientHeight'),
              minHeight: image.ancestor('.title-desc-wrapper').get('clientHeight') + Y.one('#header').get('clientHeight')
            });
          }

          image.one('img').removeAttribute('data-load');
          ImageLoader.load(image.one('img'), {
            mode: 'fill'
          });
        });

        // Handle IE case (which is generally treated as mobile view)
        if (Y.UA.ie > 0 && Y.UA.ie <= 9) {
          var imageH = i === 0 ? this.firstImageHeight - Y.one('#header').height() : this.restImageHeight;
          img && Y.one('.title-desc-wrapper').setStyle('height', imageH + 'px');
        }

      } else {

        Y.one('body').addClass('mobile-parallax');

        Y.all('.title-desc-image').each(function (image, i) {
          if (i === 0) {
            image.setStyle('height', imageHeight + Y.one('#header').get('clientHeight'));
          } else {
            image.setStyle('height', viewportHeight);
          }

          image.one('img').removeAttribute('data-load');
          ImageLoader.load(image.one('img'), {
            mode: 'fill'
          });
        });

      }

    },

    setupMobileNav: function() {
      // Open/close mobile nav
      Y.one('#mobileMenu').on('click', function() {
        setMobileNav(!Y.one('body').hasClass('mobile-nav-open'));
      });

      var setMobileNav = function(enable) {
        if (enable) {
          Y.one('body').addClass('mobile-nav-open');
        } else {
          Y.one('body').removeClass('mobile-nav-open');
        }
      };

      // folders in mobile
      Y.all('li.folder').each(function(elem) {
        elem.on('click', function() {
          toggleFolder(elem.siblings('li.folder.dropdown-open').item(0));
          toggleFolder(elem);
        });
      });
      var toggleFolder = function(elem) {
        if (elem) {
          elem.toggleClass('dropdown-open');
        }
      };
    },


    // position background image for non-index pages
    positionBackgroundImage: function(e) {
      var scrollTop = this.scrollEl.get('scrollTop'),
          viewportRegion = Y.one(Y.config.win).get('region'),
          img = Y.one('.banner-image img');

      if (this.parallaxOff || this.isMobile || !img || scrollTop > viewportRegion.height) {
        return;
      }

      img.setStyle('transform', 'translate3d(0,'+parseInt(scrollTop * this.PARALLAX_FACTOR,10)+'px,0)');
    },


    /**************** Index Page Handling below **************/

    // Index collection navigation
    onHashChange: function(e) {
      if (Y.one('.mobile-nav-open')) {
        Y.one('body').removeClass('mobile-nav-open');
      }

      var hashTarget = Y.one('.parallax-item[data-url-id="'+e.newHash+'"]');

      if(hashTarget) {
        var targetY = this.pageOffsets[e.newHash];
        if (e.quick) {
          this.scrollEl.set('scrollTop', targetY);
          this.updateActivePage();
        } else {
          this.autoScrolling = true;

          this.scrollEl.anim({}, {
            to: { scroll: [0, targetY ] },
            duration: this.SCROLL_SPEED,
            easing: Y.Easing.easeBoth
          }).run().on('end', function() {
            if(this.scrollEl.get('scrollTop') !== targetY) {
              this.scrollEl.set('scrollTop', targetY);
            }
            this.autoScrolling = false;
            this.updateActivePage();
          }, this);        
        }
      }
    },

    getPageFromOffset: function(posY) {

      if (this.parallaxPages.item(0)) {
        var pageName = this.parallaxPages.item(0).getAttribute('data-url-id');

        for(var name in this.pageOffsets) {
          if (posY >= this.pageOffsets[name] && 
              this.pageOffsets[name] > this.pageOffsets[pageName]) {
            pageName = name;
          }
        }

        return pageName;
      }
    },

    // update active page on index collection
    updateActivePage: function() {
      if (this.autoScrolling) {
        return;
      }

      var scrollTop = this.scrollEl.get('scrollTop'),
          activePage = this.getPageFromOffset(scrollTop);

      if (Y.one('#parallax-nav')) {
        Y.one('#parallax-nav a[href="#'+activePage+'"]').get('parentNode').addClass('active').siblings().removeClass('active');

        if (window.location.hash.replace('#', '') != activePage) {
          window.history && window.history.replaceState && window.history.replaceState({}, '', '#' + activePage);
        }
      }

      var img = this.isMobile ? Y.one('.parallax-item[data-url-id="'+activePage+'"] .title-desc-wrapper img')
                  : Y.one('#parallax-images .image-container[data-url-id="'+activePage+'"] img');
      Y.Squarespace.GalleryManager.promoteImageQueue(new Y.NodeList(img));  

      if (!Y.one('body.hide-parallax-nav')) {
        // Set suggested foreground color
        var pageComingUp = this.getPageFromOffset(scrollTop + this.viewportH/2),
            contentOffset = this.pageOffsets[pageComingUp] === 0 ? this.firstImageHeight : this.viewportH * this.IMAGE_VIEWPORT,
            color;

        // Use image color detection if image is half-way up the viewport
        if (scrollTop + this.viewportH/2 <= this.pageOffsets[pageComingUp] + contentOffset) {
          color = Y.one('.parallax-item[data-url-id="'+pageComingUp+'"] .title-desc-wrapper').getAttribute('data-color-suggested');
        }

        if (!color || color === '#') { // else use background color
          color = Y.Squarespace.Template.getTweakValue('contentBgColor');
          var rgba = color.match(new RegExp('rgba\\((\\d+),(\\d+),(\\d+),(\\d+)'));
          if (rgba) {
            color = this._rgb2hex(rgba[1],rgba[2],rgba[3]);
          }
        }

        Y.one('body').removeClass('color-weight-dark').removeClass('color-weight-light').addClass('color-weight-' + this._getLightness(color));  
      }

    },

    _rgb2hex: function(r, g, b) {
      var parts = [r,g,b];

      for (var i = 0; i <= 2; ++i) {
        parts[i] = parseInt(parts[i], 10).toString(16);

        if (parts[i].length == 1)
          parts[i] = '0' + parts[i];
      }

      return '#'+parts.join('');
    },

    _getLightness: function(hexcolor) {
      if (hexcolor && hexcolor.length > 0 && hexcolor.length <= 7) {
        hexcolor = hexcolor.replace('#', '');
        return ((parseInt(hexcolor, 16) > 0xffffff/2) ? 'light' : 'dark');
      } else {
        return '';
      }
    },

    // Position images on index collection
    positionImages: function(e) {
      if (this.isMobile) return;

      var scrollTop = this.scrollEl.get('scrollTop'),
          viewportRegion = Y.one(Y.config.win).get('region');

      this.parallaxPages.each(function(page,i) {
        
        if(page.inRegion(viewportRegion)) {
          var pageYDoc = this.pageOffsets[page.getAttribute('data-url-id')],
              pageYViewport = pageYDoc - scrollTop,
              factor = this.parallaxOff ? 0 : this.PARALLAX_FACTOR,
              imageY = -1 * parseInt(pageYViewport * factor),
              imageContainer = this.parallaxImages.item(i),
              image = imageContainer.one('img');

          imageContainer.setStyle('transform', 'translate3d(0,'+pageYViewport+'px,0)');
          image && image.setStyle('transform', 'translate3d(0,'+imageY+'px,0)');          

        } else {
          this.parallaxImages.item(i).setStyle('transform', 'translate3d(0,-9000px,0)');
        }

      }, this);
    },

    listenTweaks: function() {
      if (Y.Global) {
        Y.Global.on('tweak:change', function(f){
          if (f.getName().match(/image|parallax|title--description-alignment|fixed-header/i)) {
            this.syncUI();
          }
        },this);

        Y.Global.on(['tweak:reset', 'tweak:close'], function(f){
          Y.later(500, this, this.syncUI);
        },this);

      }
    }

  });

  Y.on('domready', function() {
    var announcementBar = Y.one('.sqs-announcement-bar');
    var fixedHeader = Y.one('.fixed-header');

    if (announcementBar && fixedHeader) {

      var offset = announcementBar.get('clientHeight');
      var announcementBarClose = Y.one('.sqs-announcement-bar-close');
      var header = Y.one('#header');

      announcementBar.setStyles({
        'position' : 'fixed',
        'width' : '100%'

      });

      if (header && announcementBarClose) {

        header.setStyle('top', offset);

        announcementBarClose.on('click', function(){
          header.setStyle('top', '0');
        });
      }
    }

    
  });



});
