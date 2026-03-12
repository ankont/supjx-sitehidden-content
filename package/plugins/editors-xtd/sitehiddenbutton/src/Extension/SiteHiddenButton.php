<?php
namespace SuperSoft\Plugin\EditorsXtd\SiteHiddenButton\Extension;

defined('_JEXEC') or die;

use Joomla\CMS\Language\Text;
use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\CMS\Editor\Button\Button;
use Joomla\Event\SubscriberInterface;
use Joomla\CMS\Event\Editor\EditorButtonsSetupEvent;
use Joomla\Event\DispatcherInterface;

final class SiteHiddenButton extends CMSPlugin implements SubscriberInterface
{
    protected $autoloadLanguage = true;

    public function __construct(DispatcherInterface $dispatcher, array $config = [])
    {
        parent::__construct($dispatcher, $config);
    }

    public static function getSubscribedEvents(): array
    {
        return ['onEditorButtonsSetup' => 'onEditorButtonsSetup'];
    }

    public function onEditorButtonsSetup(EditorButtonsSetupEvent $event): void
    {
        $wa = Factory::getApplication()->getDocument()->getWebAssetManager();

        $wa->registerScript(
            'plg.editorsxtd.sitehiddenbutton',
            'plg_editors-xtd_sitehiddenbutton/sitehiddenbutton.js',
            ['defer' => true],
            ['version' => 'auto']
        );
        $wa->registerStyle(
            'plg.editorsxtd.sitehiddenbutton',
            'plg_editors-xtd_sitehiddenbutton/sitehiddenbutton.css',
            [],
            ['version' => 'auto']
        );
        $wa->useScript('plg.editorsxtd.sitehiddenbutton');
        $wa->useStyle('plg.editorsxtd.sitehiddenbutton');

        $button = new Button('sitehiddenbutton', [
            'text'    => Text::_('PLG_EDITORSXTD_SITEHIDDENBUTTON_LABEL'),
            'icon'    => '',
            'iconSVG' => '<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' width=\'16\' height=\'16\' aria-hidden=\'true\' focusable=\'false\'><path d=\'M12 5c5 0 9 4 10 7-1 3-5 7-10 7S3 15 2 12c1-3 5-7 10-7z\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'/><circle cx=\'12\' cy=\'12\' r=\'3\' fill=\'currentColor\'/><line x1=\'4\' y1=\'4\' x2=\'20\' y2=\'20\' stroke=\'currentColor\' stroke-width=\'2\'/></svg>',
            'action'  => 'sitehiddenbutton:open',
        ]);

        $event->getButtonsRegistry()->add($button);
    }
}